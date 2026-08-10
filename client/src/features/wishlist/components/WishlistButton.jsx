import { useState } from "react";
import { Heart } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  addToWishlistThunk,
  removeFromWishlistThunk,
  fetchWishlistThunk,
} from "@/features/wishlist/wishlistThunks";
import { selectIsInWishlist } from "@/features/wishlist/wishlistSelectors";
import { selectIsAuthenticated } from "@/features/auth/authSelectors";

export default function WishlistButton({
  productId,
  className = "",
  size = "md",
}) {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInWishlist = useAppSelector(selectIsInWishlist(productId));
  const [isToggling, setIsToggling] = useState(false);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  const handleToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      alert("Please login to add items to your wishlist");
      return;
    }

    setIsToggling(true);
    try {
      if (isInWishlist) {
        await dispatch(removeFromWishlistThunk(productId)).unwrap();
      } else {
        await dispatch(addToWishlistThunk(productId)).unwrap();
        await dispatch(fetchWishlistThunk());
      }
    } catch (error) {
      console.error("Wishlist toggle error:", error);
    } finally {
      setIsToggling(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={`
        ${sizeClasses[size]}
        ${className}
        flex items-center justify-center rounded-full
        transition-all duration-200
        ${
          isInWishlist
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-white text-gray-600 hover:bg-gray-100 hover:text-red-500"
        }
        border-2
        ${isInWishlist ? "border-red-500" : "border-gray-300"}
        disabled:cursor-not-allowed disabled:opacity-60
        shadow-sm hover:shadow
      `}
      title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
      aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Heart
        size={iconSizes[size]}
        className={isInWishlist ? "fill-current" : ""}
      />
    </button>
  );
}
