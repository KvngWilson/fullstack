import { createElement, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  fetchFeaturedProductsThunk,
  fetchCategoriesThunk,
} from "@/features/products/productsThunks";
import {
  selectFeaturedProducts,
  selectCategories,
  selectProductsError,
  selectProductsLoading,
} from "@/features/products/productsSlice";
import WishlistButton from "@/features/wishlist/components/WishlistButton";
import { ProductGridSkeleton } from "@/components/common/Skeleton";
import { ErrorState } from "@/components/common/AsyncState";
import { notifyInfo } from "@/utils/toast";
import { Button, Card } from "@/components/ui";

const fallbackCategories = [
  {
    name: "Shoes",
    slug: "shoes",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80",
  },
  {
    name: "Jewelry",
    slug: "jewelry",
    image:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=200&q=80",
  },
  {
    name: "Bags",
    slug: "bags",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=200&q=80",
  },
  {
    name: "Hats",
    slug: "hats",
    image:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=200&q=80",
  },
  {
    name: "Accessories",
    slug: "accessories",
    image:
      "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=200&q=80",
  },
  {
    name: "Beauty",
    slug: "beauty",
    image:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=200&q=80",
  },
];

const promoTiles = [
  {
    title: "New Year New Fashion",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Sportswear essentials",
    image:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Beauty picks",
    image:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80",
  },
  {
    title: "Home & Kitchen",
    image:
      "https://images.unsplash.com/photo-1501045661006-fcebe0257c3f?auto=format&fit=crop&w=600&q=80",
  },
];

const testimonials = [
  {
    name: "Emily R.",
    quote: "Fast delivery and amazing packaging. Love the curated picks every week.",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80",
  },
  {
    name: "John D.",
    quote: "The discounts are real. I saved $120 on my last electronics order.",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=80&q=80",
  },
  {
    name: "Amina K.",
    quote: "Stylish, affordable, and on time. Dealport is my go-to now.",
    avatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=80&q=80",
  },
];

const heroStats = [
  { value: "12k+", label: "happy shoppers" },
  { value: "350+", label: "weekly drops" },
  { value: "4.9/5", label: "average rating" },
];

const shoppingPerks = [
  {
    icon: Truck,
    title: "Quick delivery",
    description: "Streamlined shipping for fast-moving essentials and trend-led finds.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    description: "Checkout and account flows designed to feel trustworthy and effortless.",
  },
  {
    icon: TrendingUp,
    title: "Always trending",
    description: "Freshly merchandised collections with modern aesthetics and strong value.",
  },
];

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function Home() {
  const dispatch = useAppDispatch();
  const featuredProducts = useAppSelector(selectFeaturedProducts);
  const categories = useAppSelector(selectCategories);
  const isLoading = useAppSelector(selectProductsLoading);
  const error = useAppSelector(selectProductsError);

  useEffect(() => {
    dispatch(fetchFeaturedProductsThunk(8));
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  const handleRetryFeatured = () => {
    notifyInfo("Retrying featured products...");
    dispatch(fetchFeaturedProductsThunk(8));
    dispatch(fetchCategoriesThunk());
  };

  const displayCategories = categories.length
    ? categories.map((category, index) => ({
        name: category.name,
        slug: category.slug || category.name?.toLowerCase() || category.id,
        image: category.image || fallbackCategories[index % fallbackCategories.length].image,
      }))
    : fallbackCategories;

  const displayProducts = featuredProducts.length
    ? featuredProducts
    : [
        {
          id: "1",
          name: "Radiant Glow Hydrating Serum",
          base_price: 29.99,
          image:
            "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=600&q=80",
        },
        {
          id: "2",
          name: "Modern Minimalist Vase",
          base_price: 59.0,
          image:
            "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80",
        },
        {
          id: "3",
          name: "FitPro 3000 Smartwatch",
          base_price: 119.99,
          image:
            "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=600&q=80",
        },
        {
          id: "4",
          name: "Trending collection for men",
          base_price: 89.99,
          image:
            "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=600&q=80",
        },
      ];

  const shouldShowProductSkeleton = isLoading && !featuredProducts.length;

  return (
    <div className="pb-8">
      <section className="landing-container space-lg-y">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.85fr)]">
          <div className="relative overflow-hidden rounded-section border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.9)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.32),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.24),transparent_34%)]"
            />
            <img
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80"
              alt="Featured shopping collection"
              className="absolute inset-y-0 right-0 hidden h-full w-[48%] object-cover opacity-55 lg:block"
            />
            <div className="relative z-10 max-w-xl">
              <span className="tag-soft bg-white/12 text-sky-100">
                <Sparkles className="h-3.5 w-3.5" />
                Curated this week
              </span>
              <h1 className="mt-5 font-heading text-4xl font-bold leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
                Sleek finds for style, beauty, home, and everyday upgrades.
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-slate-200 sm:text-base">
                Explore premium-looking essentials and standout deals designed to make your
                storefront feel polished, current, and conversion-friendly.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link className="btn-primary" to="/products">
                  Shop collection
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link className="btn-ghost text-white hover:text-slate-950" to="/category/fashion">
                  View seasonal picks
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-card border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-md"
                  >
                    <p className="font-heading text-2xl font-bold text-white">{item.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <Card variant="elevated" className="bg-white/80">
              <span className="tag-soft">Flash deal</span>
              <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-950">
                Kids accessories with a fresh, editorial look.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Mix soft palettes, standout texture, and practical pieces shoppers love to
                revisit.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="btn-primary" to="/category/accessories">
                  Shop now
                </Link>
                <Link className="btn-ghost" to="/products">
                  Learn more
                </Link>
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              {promoTiles.map((tile, index) => (
                <Card key={tile.title} padding="none" className="overflow-hidden">
                  <img
                    src={tile.image}
                    alt={tile.title}
                    className="h-36 w-full object-cover"
                  />
                  <div className="space-section">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">
                      Edit {index + 1}
                    </p>
                    <p className="mt-2 font-heading text-lg font-semibold text-slate-900">
                      {tile.title}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">Shop now</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-container">
        <div className="grid gap-4 rounded-section border border-white/70 bg-white/75 p-5 shadow-[0_20px_70px_-46px_rgba(15,23,42,0.3)] backdrop-blur-lg md:grid-cols-3 md:p-6">
          {shoppingPerks.map(({ icon, title, description }) => (
            <div key={title} className="rounded-card border border-slate-100 bg-white/80 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                {createElement(icon, { className: "h-5 w-5" })}
              </span>
              <h2 className="mt-4 font-heading text-xl font-semibold tracking-tight text-slate-950">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-container section-wrap">
        <div className="flex flex-wrap gap-3">
          <button className="pill pill-active" type="button">
            All
          </button>
          {displayCategories.map((category) => (
            <Link key={category.slug} to={`/category/${category.slug}`} className="pill">
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-container section-wrap pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Trending products with elevated presentation.</h2>
            <p className="section-subtitle">
              Hand-picked editor favorites arranged to feel premium and easy to browse.
            </p>
          </div>
          <Link to="/products" className="btn-ghost">
            View all
          </Link>
        </div>

        {shouldShowProductSkeleton ? (
          <div className="mt-6">
            <ProductGridSkeleton count={4} />
          </div>
        ) : error ? (
          <ErrorState
            title="Could not load featured products"
            message={error}
            onRetry={handleRetryFeatured}
            className="mt-6"
          />
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {displayProducts.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`} className="product-card group">
                <div className="product-image relative">
                  <img
                    src={product.image || promoTiles[0].image}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute right-3 top-3">
                    <WishlistButton productId={product.id} size="sm" />
                  </div>
                </div>
                <div className="space-section-t">
                  <div className="flex items-center justify-between gap-3">
                    <span className="tag-soft">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      Top pick
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Featured
                    </span>
                  </div>
                  <p className="mt-4 line-clamp-2 font-heading text-lg font-semibold text-slate-900">
                    {product.name}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-lg font-bold text-slate-950">
                      {formatPrice(product.base_price ?? product.price ?? 0)}
                    </p>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      Add to cart
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="landing-container section-wrap pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Start with clean, modern category browsing.</h2>
            <p className="section-subtitle">
              Use structured collections to guide shoppers through your best-performing
              categories.
            </p>
          </div>
          <Link to="/products" className="btn-ghost">
            Explore all
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {displayCategories.map((category) => (
            <Link key={category.slug} to={`/category/${category.slug}`} className="category-card">
              <img src={category.image} alt={category.name} className="category-avatar" />
              <p className="mt-4 font-heading text-base font-semibold text-slate-900">
                {category.name}
              </p>
              <p className="mt-1 text-sm text-slate-500">Shop now</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-container section-wrap pt-0">
        <div className="rounded-section border border-white/70 bg-white/80 p-6 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.3)] backdrop-blur-xl lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Limited-time deals worth spotlighting.</h2>
              <p className="section-subtitle">
                Showcase time-sensitive offers with stronger contrast, clearer hierarchy,
                and softer luxury styling.
              </p>
            </div>
            <Link to="/products" className="btn-ghost">
              Browse deals
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {displayProducts.slice(0, 4).map((product) => (
              <Link key={`deal-${product.id}`} to={`/products/${product.id}`} className="product-card group">
                <div className="deal-image relative">
                  <img
                    src={product.image || promoTiles[1].image}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute right-3 top-3">
                    <WishlistButton productId={product.id} size="sm" />
                  </div>
                </div>
                <div className="space-section-t">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">
                    Limited drop
                  </p>
                  <p className="mt-3 line-clamp-2 font-heading text-lg font-semibold text-slate-900">
                    {product.name}
                  </p>
                  <p className="mt-3 text-lg font-bold text-slate-950">
                    {formatPrice(product.base_price ?? product.price ?? 0)}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <Button className="flex-1" variant="ghost">
                      View
                    </Button>
                    <Button className="flex-1" variant="primary">
                      Add to cart
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-container section-wrap pt-0">
        <div className="rounded-section border border-slate-950/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96))] p-6 text-white shadow-[0_30px_90px_-52px_rgba(15,23,42,0.95)] lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="section-title text-white">Customers notice the difference.</h2>
              <p className="section-subtitle max-w-2xl text-slate-300">
                A refined shopping experience helps the catalog feel more premium while
                keeping flows easy to navigate.
              </p>
            </div>
            <Button className="self-start lg:self-auto" size="lg" variant="primary">
              Get started
            </Button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <div
                key={item.name}
                className="testimonial-card border-white/10 bg-white/10 text-slate-100"
              >
                <div className="flex items-center gap-section-sm">
                  <img
                    src={item.avatar}
                    alt={item.name}
                    className="avatar-img rounded-avatar object-cover"
                  />
                  <div>
                    <p className="font-heading text-lg font-semibold">{item.name}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      Verified buyer
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-7 text-slate-300">{item.quote}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
