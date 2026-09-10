import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { EmptyState, ErrorState } from "@/components/common/AsyncState";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { adminProductsApi } from "@/api/endpoints/adminProducts";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { resolveAssetUrl } from "@/utils/resolveAssetUrl";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  category_id: "",
  vendor_id: "",
  base_price: "",
  brand: "",
  material: "",
  care_instructions: "",
  sku: "",
  stock: "0",
  is_active: true,
  imageFile: null,
  image_url: "",
};

const formatPrice = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function ProductCard({ product, onEdit, onDelete, deletingId }) {
  const displayPrice =
    product.base_price ?? product.min_price ?? product.max_price ?? 0;
  const stock = product.variants?.[0]?.stock;

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="relative aspect-square overflow-hidden rounded-surface bg-slate-100">
        <img
          src={
            resolveAssetUrl(product.image_url) ||
            "https://via.placeholder.com/600x600?text=No+Image"
          }
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {product.vendor_name || product.brand || "Catalog item"}
            </p>
            <h2 className="mt-2 font-heading text-xl font-semibold tracking-tight text-slate-950">
              {product.name}
            </h2>
          </div>
          <Badge variant={product.is_active ? "secondary" : "muted"}>
            {product.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-500">
          <p>
            Price:{" "}
            <span className="font-semibold text-slate-900">
              {formatPrice(displayPrice)}
            </span>
          </p>
          <p>
            Category:{" "}
            <span className="font-semibold text-slate-900">
              {product.category_name || "Unassigned"}
            </span>
          </p>
          <p>
            SKU:{" "}
            <span className="font-semibold text-slate-900">
              {product.variants?.[0]?.sku || "Auto-generated"}
            </span>
          </p>
          <p>
            Stock:{" "}
            <span className="font-semibold text-slate-900">{stock ?? 0}</span>
          </p>
        </div>

        <div className="mt-5 flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={() => onEdit(product.id)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            loading={deletingId === product.id}
            onClick={() => onDelete(product.id)}
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function Products() {
  const [state, setState] = useState({
    loading: true,
    saving: false,
    deletingId: null,
    error: "",
    formError: "",
    success: "",
    products: [],
    categories: [],
    vendors: [],
    editingProductId: null,
  });
  const [filters, setFilters] = useState({ search: "" });
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const [productsResponse, categories, vendors] = await Promise.all([
        adminProductsApi.listProducts({ pageSize: 100 }),
        adminProductsApi.getCategories(),
        adminProductsApi.listVendors(),
      ]);

      setState((current) => ({
        ...current,
        loading: false,
        error: "",
        products: productsResponse?.products || [],
        categories,
        vendors,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(
          error,
          "Failed to load product management data.",
        ),
      }));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    if (!query) {
      return state.products;
    }

    return state.products.filter((product) =>
      [
        product.name,
        product.slug,
        product.brand,
        product.category_name,
        product.vendor_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [filters.search, state.products]);

  const resetForm = () => {
    setForm(emptyForm);
    setState((current) => ({
      ...current,
      editingProductId: null,
      formError: "",
      success: "",
    }));
  };

  const handleChange = (event) => {
    const { name, value, type, checked, files } = event.target;

    if (type === "file") {
      const file = files?.[0] || null;
      setForm((current) => ({
        ...current,
        imageFile: file,
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEdit = async (productId) => {
    setState((current) => ({
      ...current,
      formError: "",
      success: "",
    }));

    try {
      const product = await adminProductsApi.getProductById(productId);
      const primaryVariant = product?.variants?.[0] || {};

      setForm({
        name: product?.name || "",
        slug: product?.slug || "",
        description: product?.description || "",
        category_id: product?.category_id ? String(product.category_id) : "",
        vendor_id: product?.vendor_id ? String(product.vendor_id) : "",
        base_price:
          product?.base_price !== null && product?.base_price !== undefined
            ? String(product.base_price)
            : "",
        brand: product?.brand || "",
        material: product?.material || "",
        care_instructions: product?.care_instructions || "",
        sku: primaryVariant?.sku || "",
        stock:
          primaryVariant?.stock !== null && primaryVariant?.stock !== undefined
            ? String(primaryVariant.stock)
            : "0",
        is_active: Boolean(product?.is_active),
        imageFile: null,
        image_url: product?.image_url || "",
      });

      setState((current) => ({
        ...current,
        editingProductId: productId,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        formError: getErrorMessage(error, "Failed to load product details."),
      }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setState((current) => ({
      ...current,
      saving: true,
      formError: "",
      success: "",
    }));

    try {
      const payload = {
        ...form,
        category_id: form.category_id || null,
        vendor_id: form.vendor_id || null,
      };

      if (state.editingProductId) {
        await adminProductsApi.updateProduct(state.editingProductId, payload);
      } else {
        await adminProductsApi.createProduct(payload);
      }

      await loadData();
      resetForm();

      setState((current) => ({
        ...current,
        saving: false,
        success: state.editingProductId
          ? "Product updated successfully."
          : "Product created successfully.",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: false,
        formError: getErrorMessage(error, "Failed to save product."),
      }));
    }
  };

  const handleDelete = async (productId) => {
    setState((current) => ({
      ...current,
      deletingId: productId,
      error: "",
      success: "",
    }));

    try {
      await adminProductsApi.deleteProduct(productId);
      setState((current) => ({
        ...current,
        deletingId: null,
        products: current.products.filter(
          (product) => product.id !== productId,
        ),
        success: "Product deleted successfully.",
      }));

      if (state.editingProductId === productId) {
        resetForm();
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        deletingId: null,
        error: getErrorMessage(error, "Failed to delete product."),
      }));
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-10">
        <Badge variant="secondary">Admin • Products</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Create, edit, and publish catalog products
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Manage product details, vendor ownership, pricing, default inventory,
          and primary catalog images from one operational workspace.
        </p>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                {state.editingProductId ? "Edit product" : "Create product"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Products create or update a primary variant using the base
                price, SKU, and stock values below.
              </p>
            </div>
            {state.editingProductId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                New product
              </Button>
            ) : null}
          </div>

          {state.formError ? (
            <ErrorState
              className="mt-6"
              title="Could not save product"
              message={state.formError}
            />
          ) : null}

          {state.success ? (
            <Badge
              variant="secondary"
              className="mt-6 normal-case tracking-normal"
            >
              {state.success}
            </Badge>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <FormField label="Product name" required>
              <Input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </FormField>

            <FormField
              label="Slug"
              hint="Leave it readable; the backend will normalize duplicates safely."
            >
              <Input name="slug" value={form.slug} onChange={handleChange} />
            </FormField>

            <FormField label="Vendor" required>
              <Select
                name="vendor_id"
                value={form.vendor_id}
                onChange={handleChange}
                required
              >
                <option value="">Select vendor</option>
                {state.vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.store_name} ({vendor.email})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Category">
              <Select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
              >
                <option value="">No category</option>
                {state.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Base price" required>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  name="base_price"
                  value={form.base_price}
                  onChange={handleChange}
                  required
                />
              </FormField>
              <FormField label="Stock">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  name="stock"
                  value={form.stock}
                  onChange={handleChange}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Brand">
                <Input
                  name="brand"
                  value={form.brand}
                  onChange={handleChange}
                />
              </FormField>
              <FormField
                label="SKU"
                hint="Optional. Leave blank to auto-generate a default SKU."
              >
                <Input name="sku" value={form.sku} onChange={handleChange} />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Material">
                <Input
                  name="material"
                  value={form.material}
                  onChange={handleChange}
                />
              </FormField>
              <FormField label="Status">
                <label className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                  />
                  Product is active
                </label>
              </FormField>
            </div>

            <FormField label="Description">
              <Textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
              />
            </FormField>

            <FormField label="Care instructions">
              <Textarea
                name="care_instructions"
                value={form.care_instructions}
                onChange={handleChange}
                rows={3}
              />
            </FormField>

            <FormField
              label="Primary image"
              hint="Upload a new image to replace the existing product image."
            >
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleChange}
              />
            </FormField>

            {form.image_url && !form.imageFile ? (
              <img
                src={resolveAssetUrl(form.image_url)}
                alt="Current product"
                className="h-32 w-32 rounded-2xl object-cover"
              />
            ) : null}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={state.saving}
            >
              {state.editingProductId
                ? "Save product changes"
                : "Create product"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Search products
              </label>
              <Input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Search by product, vendor, category, or slug"
              />
            </div>
            <Button type="button" variant="outline" onClick={loadData}>
              Refresh
            </Button>
          </div>

          {state.error ? (
            <ErrorState
              className="mt-6"
              title="Could not load products"
              message={state.error}
              onRetry={loadData}
            />
          ) : null}

          {state.loading ? (
            <LoadingSpinner
              fullscreen={false}
              text="Loading products..."
              className="py-16"
            />
          ) : null}

          {!state.loading && !filteredProducts.length ? (
            <EmptyState
              className="mt-6"
              title="No products found"
              message="Create a product or adjust the search term."
            />
          ) : null}

          {!state.loading && filteredProducts.length ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  deletingId={state.deletingId}
                />
              ))}
            </div>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
