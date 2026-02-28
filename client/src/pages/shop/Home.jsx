import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchFeaturedProductsThunk,
  fetchCategoriesThunk,
} from '@/features/products/productsThunks';
import {
  selectFeaturedProducts,
  selectProductCategories,
  selectProductsError,
  selectProductsIsLoading,
} from '@/features/products/productsSelectors';
import WishlistButton from '@/components/product/WishlistButton';

const fallbackCategories = [
  { name: 'Grocery', slug: 'grocery', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80' },
  { name: 'Home', slug: 'home', image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=200&q=80' },
  { name: 'Fashion', slug: 'fashion', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=200&q=80' },
  { name: 'Electronics', slug: 'electronics', image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=200&q=80' },
  { name: 'Toys', slug: 'toys', image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=200&q=80' },
  { name: 'Beauty', slug: 'beauty', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=200&q=80' },
];

const promoTiles = [
  {
    title: 'New Year New Fashion',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Gaming accessories',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Beauty picks',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Home & Kitchen',
    image: 'https://images.unsplash.com/photo-1501045661006-fcebe0257c3f?auto=format&fit=crop&w=600&q=80',
  },
];

const testimonials = [
  {
    name: 'Emily R.',
    quote: 'Fast delivery and amazing packaging. Love the curated picks every week.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80',
  },
  {
    name: 'John D.',
    quote: 'The discounts are real. I saved $120 on my last electronics order.',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=80&q=80',
  },
  {
    name: 'Amina K.',
    quote: 'Stylish, affordable, and on time. Dealport is my go-to now.',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=80&q=80',
  },
];

export default function Home() {
  const dispatch = useAppDispatch();
  const featuredProducts = useAppSelector(selectFeaturedProducts);
  const categories = useAppSelector(selectProductCategories);
  const isLoading = useAppSelector(selectProductsIsLoading);
  const error = useAppSelector(selectProductsError);

  useEffect(() => {
    dispatch(fetchFeaturedProductsThunk(8));
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  const displayCategories = categories.length
    ? categories.map((category) => ({
        name: category.name,
        slug: category.slug || category.name?.toLowerCase() || category.id,
        image: category.image || fallbackCategories[0].image,
      }))
    : fallbackCategories;

  const displayProducts = featuredProducts.length
    ? featuredProducts
    : [
        {
          id: '1',
          name: 'Radiant Glow Hydrating Serum',
          base_price: 29.99,
          image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: '2',
          name: 'Modern Minimalist Vase',
          base_price: 59.0,
          image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: '3',
          name: 'FitPro 3000 Smartwatch',
          base_price: 119.99,
          image: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=600&q=80',
        },
        {
          id: '4',
          name: 'Trending collection for men',
          base_price: 89.99,
          image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=600&q=80',
        },
      ];

  return (
    <div className="landing-surface">
      <section className="landing-container section-wrap">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="hero-panel lg:col-span-7">
            <img
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80"
              alt="Hero"
              className="hero-image"
            />
            <div className="hero-overlay" />
            <div className="hero-content">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">Discover the latest deals</p>
                <h1 className="mt-4 text-4xl font-semibold leading-tight text-white">
                  Up to 50% off!
                </h1>
                <p className="mt-3 max-w-md text-sm text-white/80">
                  Refresh your wardrobe, upgrade your tech, and elevate your space with curated savings.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-wrap gap-3">
                  <button className="btn-primary">Shop Now</button>
                  <button className="btn-ghost text-white border-white/50 hover:bg-white/10">View Deals</button>
                </div>
                <div className="dot-row">
                  <span className="dot dot-active"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:col-span-5">
            <div className="promo-card">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Flash deal</p>
              <h2 className="mt-3 text-2xl font-semibold">Gaming accessories</h2>
              <p className="mt-2 text-sm text-muted-foreground">Bundle and save on controllers and gear.</p>
              <div className="mt-4 flex gap-3">
                <button className="btn-primary">Shop Now</button>
                <button className="btn-ghost">Learn more</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {promoTiles.map((tile) => (
                <div key={tile.title} className="promo-tile">
                  <img src={tile.image} alt={tile.title} className="h-32 w-full object-cover" />
                  <div className="p-4">
                    <p className="text-sm font-semibold text-foreground">{tile.title}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Shop now</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-container pb-4">
        <div className="flex flex-wrap gap-3">
          <button className="pill pill-active">All</button>
          {displayCategories.map((category) => (
            <Link key={category.slug} to={`/category/${category.slug}`} className="pill">
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-container section-wrap">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Trending Product</h2>
            <p className="section-subtitle">Hand-picked by our editors</p>
          </div>
          <Link to="/products" className="btn-ghost">View all</Link>
        </div>

        {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading featured products...</p>}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {displayProducts.map((product) => (
            <Link key={product.id} to={`/products/${product.id}`} className="product-card">
              <div className="product-image relative">
                <img
                  src={product.image || promoTiles[0].image}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute right-2 top-2">
                  <WishlistButton productId={product.id} size="sm" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground">{product.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">${product.base_price ?? product.price ?? 0}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="tag-soft">Top pick</span>
                  <button className="btn-primary px-4 py-2 text-xs">Add to cart</button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-container section-wrap">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Start exploring now</h2>
            <p className="section-subtitle">Shop by category</p>
          </div>
          <Link to="/products" className="btn-ghost">View all</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {displayCategories.map((category) => (
            <Link key={category.slug} to={`/category/${category.slug}`} className="category-card">
              <img src={category.image} alt={category.name} className="category-avatar" />
              <p className="mt-3 text-sm font-semibold text-foreground">{category.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-container section-wrap">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Limited-Time Deal</h2>
            <p className="section-subtitle">Best selling product</p>
          </div>
          <Link to="/products" className="btn-ghost">View all</Link>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {displayProducts.slice(0, 4).map((product) => (
            <Link key={`deal-${product.id}`} to={`/products/${product.id}`} className="product-card">
              <div className="deal-image relative">
                <img
                  src={product.image || promoTiles[1].image}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute right-2 top-2">
                  <WishlistButton productId={product.id} size="sm" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold text-foreground">{product.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">${product.base_price ?? product.price ?? 0}</p>
                <div className="mt-3 flex items-center justify-between">
                  <button className="btn-ghost px-3 py-2 text-xs">View</button>
                  <button className="btn-primary px-3 py-2 text-xs">Add to cart</button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-container section-wrap">
        <div className="rounded-3xl bg-white p-8 shadow-sm border border-border">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="section-title">Our Happy Customers</h2>
              <p className="section-subtitle">Real feedback from verified buyers.</p>
            </div>
            <button className="btn-primary">Get started</button>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {testimonials.map((item) => (
              <div key={item.name} className="testimonial-card">
                <div className="flex items-center gap-3">
                  <img src={item.avatar} alt={item.name} className="h-10 w-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Verified buyer</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{item.quote}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
