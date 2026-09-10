// Profile controller: handles user profile, addresses, preferences, password changes
const db = require("../../../../config/db");
const argon2 = require("argon2");
const {
  successResponse,
  errorResponse,
} = require("../../../../shared/utils/response");
const logger = require("../../../../shared/utils/logger");
const { addUserLinks } = require("../../../../shared/utils/hateoas");
const domain = require("../../../../domain");

const pool = db.pool || db;
const ADDRESS_TYPES = new Set(["shipping", "billing"]);
const permissionService = domain.identity.services.PermissionService;

const runInTransaction = async (handler) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};


// Get user profile information
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const userQuery = `
      SELECT id,
             email,
             NULL::text AS first_name,
             NULL::text AS last_name,
             role,
             created_at,
             last_login
      FROM users
      WHERE id = $1
    `;
    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return errorResponse(res, { message: "User not found", status: 404 });
    }

    // Add HATEOAS links to user profile response
    const userWithLinks = addUserLinks(userResult.rows[0]);
    userWithLinks.permissions = await permissionService.resolvePermissionsForUser(
      req.user,
    );

    return successResponse(res, {
      data: userWithLinks,
      message: "Profile retrieved successfully",
    });
  } catch (error) {
    logger.error("Error getting profile", { error, userId: req.user.id });
    return errorResponse(res, {
      message: "Failed to retrieve profile",
      status: 500,
    });
  }
};

// Update user profile information
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      first_name,
      last_name,
      phone,
      bio,
      avatar_url,
      date_of_birth,
      preferred_language,
      email,
    } = req.body;

    // Validate at least one field is provided
    if (
      !first_name &&
      !last_name &&
      !phone &&
      !bio &&
      !avatar_url &&
      !date_of_birth &&
      !preferred_language &&
      !email
    ) {
      return errorResponse(res, {
        message: "At least one field is required to update",
        status: 400,
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email !== undefined) {
      // Check if email is already taken by another user
      const emailCheck = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email, userId],
      );

      if (emailCheck.rows.length > 0) {
        return errorResponse(res, {
          message: "Email is already in use",
          status: 400,
        });
      }

      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramCount}`);
      values.push(first_name);
      paramCount++;
    }

    if (last_name !== undefined) {
      updates.push(`last_name = $${paramCount}`);
      values.push(last_name);
      paramCount++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }

    if (bio !== undefined) {
      updates.push(`bio = $${paramCount}`);
      values.push(bio);
      paramCount++;
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount}`);
      values.push(avatar_url);
      paramCount++;
    }

    if (date_of_birth !== undefined) {
      updates.push(`date_of_birth = $${paramCount}`);
      values.push(date_of_birth);
      paramCount++;
    }

    if (preferred_language !== undefined) {
      updates.push(`preferred_language = $${paramCount}`);
      values.push(preferred_language);
      paramCount++;
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const updateQuery = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING id,
                email,
                first_name,
                last_name,
                role,
                updated_at
    `;

    const result = await pool.query(updateQuery, values);

    // Add HATEOAS links to updated profile
    const userWithLinks = addUserLinks(result.rows[0]);

    return successResponse(res, {
      data: userWithLinks,
      message: "Profile updated successfully",
    });
  } catch (error) {
    logger.error("Error updating profile", { error, userId: req.user.id });
    return errorResponse(res, {
      message: "Failed to update profile",
      status: 500,
    });
  }
};


// Change user password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return errorResponse(res, {
        message: "Current password and new password are required",
        status: 400,
      });
    }

    if (new_password.length < 8) {
      return errorResponse(res, {
        message: "New password must be at least 8 characters long",
        status: 400,
      });
    }

    // Get current password hash
    const userResult = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      return errorResponse(res, { message: "User not found", status: 404 });
    }

    // Verify current password
    const isValid = await argon2.verify(
      userResult.rows[0].password_hash,
      current_password,
    );

    if (!isValid) {
      return errorResponse(res, {
        message: "Current password is incorrect",
        status: 401,
      });
    }

    // Hash new password
    const newPasswordHash = await argon2.hash(new_password);

    // Update password
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [newPasswordHash, userId],
    );

    return successResponse(res, {
      data: null,
      message: "Password changed successfully",
    });
  } catch (error) {
    logger.error("Error changing password", { error, userId: req.user.id });
    return errorResponse(res, {
      message: "Failed to change password",
      status: 500,
    });
  }
};


// Delete user account
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return errorResponse(res, {
        message: "Password is required to delete account",
        status: 400,
      });
    }

    // Verify password
    const userResult = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      return errorResponse(res, { message: "User not found", status: 404 });
    }

    const isValid = await argon2.verify(
      userResult.rows[0].password_hash,
      password,
    );

    if (!isValid) {
      return errorResponse(res, {
        message: "Password is incorrect",
        status: 401,
      });
    }

    // Delete user (cascade will handle related records)
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    return successResponse(res, {
      data: null,
      message: "Account deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting account", { error, userId: req.user.id });
    return errorResponse(res, {
      message: "Failed to delete account",
      status: 500,
    });
  }
};

// Get all addresses for user
const getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT id, type, street, city, state, postal_code, country, is_primary
      FROM addresses
      WHERE user_id = $1
      ORDER BY is_primary DESC, id ASC
    `;

    const result = await pool.query(query, [userId]);

    return successResponse(res, {
      data: result.rows,
      message: "Addresses retrieved successfully",
    });
  } catch (error) {
    logger.error("Error getting addresses", { error, userId: req.user.id });
    return errorResponse(res, {
      message: "Failed to retrieve addresses",
      status: 500,
    });
  }
};

// Add new address
const addAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, street, city, state, postal_code, country, is_primary } =
      req.body;

    // Validate required fields
    if (!type || !street || !city || !postal_code || !country) {
      return errorResponse(res, {
        message: "Type, street, city, postal_code, and country are required",
        status: 400,
      });
    }

    // Validate type
    if (!ADDRESS_TYPES.has(type)) {
      return errorResponse(res, {
        message: 'Type must be either "shipping" or "billing"',
        status: 400,
      });
    }

    const address = await runInTransaction(async (client) => {
      if (is_primary) {
        await client.query(
          "UPDATE addresses SET is_primary = false WHERE user_id = $1 AND type = $2",
          [userId, type],
        );
      }

      const insertQuery = `
        INSERT INTO addresses (user_id, type, street, city, state, postal_code, country, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        userId,
        type,
        street,
        city,
        state || null,
        postal_code,
        country,
        is_primary || false,
      ]);

      return result.rows[0];
    });

    return successResponse(res, {
      data: address,
      message: "Address added successfully",
      status: 201,
    });
  } catch (error) {
    logger.error("Error adding address", { error, userId: req.user.id });
    return errorResponse(res, {
      message: "Failed to add address",
      status: 500,
    });
  }
};

// Update address
const updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.addressId;
    const { type, street, city, state, postal_code, country, is_primary } =
      req.body;

    // Check if address exists and belongs to user
    const checkQuery =
      "SELECT type FROM addresses WHERE id = $1 AND user_id = $2";
    const checkResult = await pool.query(checkQuery, [addressId, userId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, { message: "Address not found", status: 404 });
    }

    const currentType = checkResult.rows[0].type;
    const newType = type || currentType;

    // Validate type if provided
    if (type && !ADDRESS_TYPES.has(type)) {
      return errorResponse(res, {
        message: 'Type must be either "shipping" or "billing"',
        status: 400,
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (type !== undefined) {
      updates.push(`type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (street !== undefined) {
      updates.push(`street = $${paramCount}`);
      values.push(street);
      paramCount++;
    }

    if (city !== undefined) {
      updates.push(`city = $${paramCount}`);
      values.push(city);
      paramCount++;
    }

    if (state !== undefined) {
      updates.push(`state = $${paramCount}`);
      values.push(state);
      paramCount++;
    }

    if (postal_code !== undefined) {
      updates.push(`postal_code = $${paramCount}`);
      values.push(postal_code);
      paramCount++;
    }

    if (country !== undefined) {
      updates.push(`country = $${paramCount}`);
      values.push(country);
      paramCount++;
    }

    if (is_primary !== undefined) {
      updates.push(`is_primary = $${paramCount}`);
      values.push(is_primary);
      paramCount++;
    }

    if (updates.length === 0) {
      return errorResponse(res, {
        message: "No fields to update",
        status: 400,
      });
    }

    const updatedAddress = await runInTransaction(async (client) => {
      if (is_primary) {
        await client.query(
          "UPDATE addresses SET is_primary = false WHERE user_id = $1 AND type = $2 AND id != $3",
          [userId, newType, addressId],
        );
      }

      values.push(addressId, userId);

      const updateQuery = `
        UPDATE addresses
        SET ${updates.join(", ")}
        WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      return result.rows[0];
    });

    return successResponse(res, {
      data: updatedAddress,
      message: "Address updated successfully",
    });
  } catch (error) {
    logger.error("Error updating address", { error, userId: req.user.id });
    return errorResponse(res, {
      message: "Failed to update address",
      status: 500,
    });
  }
};


// Delete address
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.params.addressId;

    const result = await pool.query(
      "DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id",
      [addressId, userId],
    );

    if (result.rows.length === 0) {
      return errorResponse(res, { message: "Address not found", status: 404 });
    }

    return successResponse(res, {
      data: null,
      message: "Address deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting address", { error, userId: req.user.id });
    return errorResponse(res, {
      message: "Failed to delete address",
      status: 500,
    });
  }
};

// Get all saved cards for user
const getSavedCards = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT id, card_brand, last_four, exp_month, exp_year, is_primary, created_at
      FROM saved_cards
      WHERE user_id = $1
      ORDER BY is_primary DESC, created_at DESC
    `;

    const result = await pool.query(query, [userId]);

    return successResponse(res, {
      data: result.rows,
      message: "Saved cards retrieved successfully",
    });
  } catch (error) {
    logger.error("Error getting saved cards", { error, userId: req.user.id });
    return errorResponse(res, {
      message: "Failed to retrieve saved cards",
      status: 500,
    });
  }
};

// Add new saved card
const addSavedCard = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      card_brand,
      last_four,
      exp_month,
      exp_year,
      card_token,
      authorization_code,
      is_primary,
    } = req.body;

    // Validate required fields
    if (!last_four || !exp_month || !exp_year || !card_token) {
      return errorResponse(res, {
        message: "last_four, exp_month, exp_year, and card_token are required",
        status: 400,
      });
    }

    // Validate exp_month
    if (exp_month < 1 || exp_month > 12) {
      return errorResponse(res, {
        message: "exp_month must be between 1 and 12",
        status: 400,
      });
    }

    // Validate last_four length
    if (last_four.length !== 4) {
      return errorResponse(res, {
        message: "last_four must be exactly 4 digits",
        status: 400,
      });
    }

    const savedCard = await runInTransaction(async (client) => {
      if (is_primary) {
        await client.query(
          "UPDATE saved_cards SET is_primary = false WHERE user_id = $1",
          [userId],
        );
      }

      const insertQuery = `
        INSERT INTO saved_cards (user_id, card_brand, last_four, exp_month, exp_year, card_token, authorization_code, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, card_brand, last_four, exp_month, exp_year, is_primary, created_at
      `;

      const result = await client.query(insertQuery, [
        userId,
        card_brand || null,
        last_four,
        exp_month,
        exp_year,
        card_token,
        authorization_code || null,
        is_primary || false,
      ]);

      return result.rows[0];
    });

    return successResponse(res, {
      data: savedCard,
      message: "Card saved successfully",
      status: 201,
    });
  } catch (error) {
    logger.error("Error adding saved card", { error, userId: req.user.id });
    return errorResponse(res, { message: "Failed to save card", status: 500 });
  }
};

// Update saved card (e.g., set as primary)
// PATCH /api/v1/identity/profile/cards/:cardId
// Body: { isPrimary: true }
const setPrimaryCard = async (req, res) => {
  try {
    const userId = req.user.id;
    const cardId = req.params.cardId;
    const { isPrimary } = req.body;

    // Validate input
    if (isPrimary === undefined) {
      return errorResponse(res, {
        message: "isPrimary field is required",
        status: 400,
      });
    }

    const updatedCard = await runInTransaction(async (client) => {
      const checkResult = await client.query(
        "SELECT id FROM saved_cards WHERE id = $1 AND user_id = $2",
        [cardId, userId],
      );

      if (checkResult.rows.length === 0) {
        return null;
      }

      // If setting this card as primary, unset all other cards
      if (isPrimary) {
        await client.query(
          "UPDATE saved_cards SET is_primary = false WHERE user_id = $1",
          [userId],
        );
      }

      const result = await client.query(
        `UPDATE saved_cards SET is_primary = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING id, card_brand, last_four, exp_month, exp_year, is_primary`,
        [isPrimary, cardId, userId],
      );

      return result.rows[0] || null;
    });

    if (!updatedCard) {
      return errorResponse(res, { message: "Card not found", status: 404 });
    }

    return successResponse(res, {
      data: updatedCard,
      message: "Card updated successfully",
    });
  } catch (error) {
    logger.error("Error updating card", {
      error,
      userId: req.user.id,
      cardId: req.params.cardId,
    });
    return errorResponse(res, {
      message: "Failed to update card",
      status: 500,
    });
  }
};


// Delete saved card
const deleteSavedCard = async (req, res) => {
  try {
    const userId = req.user.id;
    const cardId = req.params.cardId;

    const result = await pool.query(
      "DELETE FROM saved_cards WHERE id = $1 AND user_id = $2 RETURNING id",
      [cardId, userId],
    );

    if (result.rows.length === 0) {
      return errorResponse(res, { message: "Card not found", status: 404 });
    }

    return successResponse(res, {
      data: null,
      message: "Card deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting card", { error, userId: req.user.id });
    return errorResponse(res, {
      message: "Failed to delete card",
      status: 500,
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getSavedCards,
  addSavedCard,
  setPrimaryCard,
  deleteSavedCard,
};
