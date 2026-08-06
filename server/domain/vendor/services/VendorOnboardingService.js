/**
 * Vendor Onboarding Service
 * 
 * Manages vendor registration, verification, and onboarding workflow
 */
const logger = require("../../config/logger");

const ONBOARDING_STATES = {
  REGISTRATION: "registration",
  VERIFICATION: "verification",
  BANK_SETUP: "bank_setup",
  STORE_SETUP: "store_setup",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  REJECTED: "rejected",
};

class VendorOnboardingService {
  constructor(vendorRepository, pool, eventBus) {
    this.vendorRepository = vendorRepository;
    this.pool = pool;
    this.eventBus = eventBus;
  }

  /**
   * Create vendor application
   */
  async createVendorApplication({
    userId,
    storeName,
    description,
    category,
    countryCode,
  }) {
    try {
      // Check if user already has vendor profile
      const existingVendor = await this.vendorRepository.findByUserId(userId);
      if (existingVendor) {
        throw new Error("User already has a vendor profile");
      }

      const vendorData = {
        user_id: userId,
        store_name: storeName,
        description,
        category,
        country_code: countryCode,
        onboarding_status: ONBOARDING_STATES.REGISTRATION,
        is_active: false,
        created_at: new Date(),
      };

      const vendor = await this.vendorRepository.create(vendorData);

      logger.info("Vendor application created", { vendorId: vendor.id, userId });
      return vendor;
    } catch (error) {
      logger.error("Failed to create vendor application", { userId, error });
      throw error;
    }
  }

  /**
   * Submit vendor verification documents
   */
  async submitVerificationDocuments(vendorId, documents) {
    try {
      const vendor = await this.vendorRepository.findById(vendorId);
      if (!vendor) {
        throw new Error("Vendor not found");
      }

      // Store documents (in production, upload to S3 or similar)
      await this._storeDocuments(vendorId, documents);

      vendor.onboarding_status = ONBOARDING_STATES.VERIFICATION;
      await this.vendorRepository.update(vendor);

      logger.info("Vendor verification documents submitted", { vendorId });
      return vendor;
    } catch (error) {
      logger.error("Failed to submit verification documents", { vendorId, error });
      throw error;
    }
  }

  /**
   * Approve vendor (admin only)
   */
  async approveVendor(vendorId, adminNotes = null) {
    try {
      const vendor = await this.vendorRepository.findById(vendorId);
      if (!vendor) {
        throw new Error("Vendor not found");
      }

      vendor.onboarding_status = ONBOARDING_STATES.BANK_SETUP;
      vendor.admin_notes = adminNotes;
      await this.vendorRepository.update(vendor);

      logger.info("Vendor approved", { vendorId });
      return vendor;
    } catch (error) {
      logger.error("Failed to approve vendor", { vendorId, error });
      throw error;
    }
  }

  /**
   * Reject vendor application
   */
  async rejectVendor(vendorId, reason) {
    try {
      const vendor = await this.vendorRepository.findById(vendorId);
      if (!vendor) {
        throw new Error("Vendor not found");
      }

      vendor.onboarding_status = ONBOARDING_STATES.REJECTED;
      vendor.rejection_reason = reason;
      await this.vendorRepository.update(vendor);

      logger.info("Vendor rejected", { vendorId });
      return vendor;
    } catch (error) {
      logger.error("Failed to reject vendor", { vendorId, error });
      throw error;
    }
  }

  /**
   * Setup vendor bank account for payouts
   */
  async setupBankAccount(vendorId, bankDetails) {
    try {
      const vendor = await this.vendorRepository.findById(vendorId);
      if (!vendor) {
        throw new Error("Vendor not found");
      }

      // Validate bank details (in production, use Stripe Connect or similar)
      if (!bankDetails.accountNumber || !bankDetails.routingNumber) {
        throw new Error("Invalid bank account details");
      }

      // Store encrypted bank details
      await this._storeBankDetails(vendorId, bankDetails);

      vendor.onboarding_status = ONBOARDING_STATES.STORE_SETUP;
      await this.vendorRepository.update(vendor);

      logger.info("Vendor bank account setup completed", { vendorId });
      return vendor;
    } catch (error) {
      logger.error("Failed to setup bank account", { vendorId, error });
      throw error;
    }
  }

  /**
   * Activate vendor
   */
  async activateVendor(vendorId) {
    try {
      const vendor = await this.vendorRepository.findById(vendorId);
      if (!vendor) {
        throw new Error("Vendor not found");
      }

      vendor.onboarding_status = ONBOARDING_STATES.ACTIVE;
      vendor.is_active = true;
      vendor.activated_at = new Date();
      await this.vendorRepository.update(vendor);

      logger.info("Vendor activated", { vendorId });
      return vendor;
    } catch (error) {
      logger.error("Failed to activate vendor", { vendorId, error });
      throw error;
    }
  }

  /**
   * Suspend vendor
   */
  async suspendVendor(vendorId, reason) {
    try {
      const vendor = await this.vendorRepository.findById(vendorId);
      if (!vendor) {
        throw new Error("Vendor not found");
      }

      vendor.onboarding_status = ONBOARDING_STATES.SUSPENDED;
      vendor.is_active = false;
      vendor.suspension_reason = reason;
      vendor.suspended_at = new Date();
      await this.vendorRepository.update(vendor);

      logger.info("Vendor suspended", { vendorId, reason });
      return vendor;
    } catch (error) {
      logger.error("Failed to suspend vendor", { vendorId, error });
      throw error;
    }
  }

  /**
   * Get onboarding checklist
   */
  getOnboardingChecklist(vendorStatus) {
    const checklist = {
      [ONBOARDING_STATES.REGISTRATION]: [
        { step: 1, name: "Store Information", completed: true },
      ],
      [ONBOARDING_STATES.VERIFICATION]: [
        { step: 1, name: "Store Information", completed: true },
        { step: 2, name: "Verification Documents", completed: true },
        { step: 3, name: "Admin Review", completed: false },
      ],
      [ONBOARDING_STATES.BANK_SETUP]: [
        { step: 1, name: "Store Information", completed: true },
        { step: 2, name: "Verification Documents", completed: true },
        { step: 3, name: "Admin Review", completed: true },
        { step: 4, name: "Bank Account Setup", completed: false },
      ],
      [ONBOARDING_STATES.STORE_SETUP]: [
        { step: 1, name: "Store Information", completed: true },
        { step: 2, name: "Verification Documents", completed: true },
        { step: 3, name: "Admin Review", completed: true },
        { step: 4, name: "Bank Account Setup", completed: true },
        { step: 5, name: "Store Setup", completed: false },
      ],
      [ONBOARDING_STATES.ACTIVE]: [
        { step: 1, name: "Store Information", completed: true },
        { step: 2, name: "Verification Documents", completed: true },
        { step: 3, name: "Admin Review", completed: true },
        { step: 4, name: "Bank Account Setup", completed: true },
        { step: 5, name: "Store Setup", completed: true },
      ],
    };

    return checklist[vendorStatus] || [];
  }

  // Private helper methods
  async _storeDocuments(vendorId, documents) {
    try {
      // In production, upload to S3/GCS with encryption
      logger.debug("Documents stored for vendor", { vendorId });
    } catch (error) {
      logger.error("Failed to store vendor documents", { vendorId, error });
      throw error;
    }
  }

  async _storeBankDetails(vendorId, bankDetails) {
    try {
      // In production, use Stripe Connect or similar
      // Store only last 4 digits locally for reference
      const last4 = bankDetails.accountNumber.slice(-4);
      
      const query = `
        UPDATE vendors
        SET bank_account_last4 = $1
        WHERE id = $2
      `;
      await this.pool.query(query, [last4, vendorId]);
    } catch (error) {
      logger.error("Failed to store bank details", { vendorId, error });
      throw error;
    }
  }
}

module.exports = VendorOnboardingService;
