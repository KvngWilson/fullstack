import { useMemo, useState } from "react";
import { Copy, ExternalLink, FileImage, FileText, Upload } from "lucide-react";
import { Alert, Badge, Button, Card, FormField, Input } from "@/components/ui";
import { ErrorState } from "@/components/common/AsyncState";
import { adminUploadsApi } from "@/api/endpoints/adminUploads";
import { getErrorMessage } from "@/utils/getErrorMessage";

const acceptedFileTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  ".doc",
  ".docx",
  ".txt",
  ".csv",
].join(",");

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${bytes || 0} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function FileSummary({ file }) {
  const isImage = file.type.startsWith("image/");
  const Icon = isImage ? FileImage : FileText;

  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
          <p className="text-xs text-slate-500">
            {file.type || "Unknown type"} • {formatSize(file.size)}
          </p>
        </div>
      </div>
      <Badge variant="muted" className="shrink-0 normal-case tracking-normal">
        {isImage ? "Image" : "Document"}
      </Badge>
    </div>
  );
}

function UploadedAssetCard({ asset, onCopy }) {
  const previewUrl = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${asset.url}`;

  return (
    <Card className="overflow-hidden p-0">
      {asset.kind === "image" ? (
        <img
          src={previewUrl}
          alt={asset.originalName}
          className="h-48 w-full object-cover"
        />
      ) : (
        <div className="flex h-48 items-center justify-center bg-slate-100 text-slate-500">
          <FileText className="h-12 w-12" />
        </div>
      )}

      <div className="space-y-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={asset.kind === "image" ? "secondary" : "muted"}>
              {asset.kind}
            </Badge>
            <span className="text-xs text-slate-500">{formatSize(asset.size)}</span>
          </div>
          <p className="mt-3 truncate text-sm font-semibold text-slate-900">
            {asset.originalName}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">{asset.mimeType}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => onCopy(previewUrl)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy URL
          </Button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 px-4 text-sm font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open file
          </a>
        </div>
      </div>
    </Card>
  );
}

export default function Uploads() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [state, setState] = useState({
    uploading: false,
    error: "",
    success: "",
    uploadedAssets: [],
  });

  const selectedCountLabel = useMemo(() => {
    if (!selectedFiles.length) {
      return "No files selected yet";
    }

    return `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} ready to upload`;
  }, [selectedFiles]);

  const handleFileSelection = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
    setState((current) => ({ ...current, error: "", success: "" }));
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!selectedFiles.length) {
      setState((current) => ({
        ...current,
        error: "Choose at least one file before uploading.",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      uploading: true,
      error: "",
      success: "",
    }));

    try {
      const uploadedAssets = await adminUploadsApi.uploadFiles(selectedFiles);
      setState({
        uploading: false,
        error: "",
        success: `${uploadedAssets.length} file${uploadedAssets.length === 1 ? "" : "s"} uploaded successfully.`,
        uploadedAssets,
      });
      setSelectedFiles([]);
    } catch (error) {
      setState((current) => ({
        ...current,
        uploading: false,
        error: getErrorMessage(error, "Failed to upload files."),
      }));
    }
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setState((current) => ({
        ...current,
        success: "File URL copied to clipboard.",
      }));
    } catch (_error) {
      setState((current) => ({
        ...current,
        error: "Copy failed. Open the file in a new tab and copy the URL manually.",
      }));
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-4xl border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-10">
        <Badge variant="secondary">Admin • Uploads</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Upload admin files, documents, and pictures
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Send internal images and documents through the admin path with CSRF protection,
          authenticated requests, file-type checks, and public URLs you can reuse across
          workflows.
        </p>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card className="p-6 sm:p-8">
          <form className="space-y-5" onSubmit={handleUpload}>
            <FormField
              label="Choose files"
              required
              hint="Supports JPEG, PNG, WEBP, GIF, PDF, DOC, DOCX, TXT, and CSV. Up to 10 files, 10MB each."
            >
              <Input
                type="file"
                accept={acceptedFileTypes}
                multiple
                onChange={handleFileSelection}
              />
            </FormField>

            <Alert variant="info" title="Upload readiness">
              {selectedCountLabel}
            </Alert>

            {state.error ? (
              <ErrorState
                title="Upload failed"
                message={state.error}
                className="rounded-[1.35rem] border border-red-100 bg-red-50/90 p-0"
              />
            ) : null}

            {state.success ? (
              <Alert variant="success" title="Upload status">
                {state.success}
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" size="lg" loading={state.uploading}>
              <Upload className="mr-2 h-4 w-4" />
              Upload selected files
            </Button>
          </form>

          {selectedFiles.length ? (
            <div className="mt-6 space-y-3">
              {selectedFiles.map((file) => (
                <FileSummary key={`${file.name}-${file.size}-${file.lastModified}`} file={file} />
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Uploaded assets
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                The latest successful upload returns reusable URLs under the server uploads path.
              </p>
            </div>
            <Badge variant="muted" className="normal-case tracking-normal">
              {state.uploadedAssets.length} recent result{state.uploadedAssets.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {!state.uploadedAssets.length ? (
            <Alert variant="warning" className="mt-6" title="No uploads yet">
              Upload a file from the form to preview the generated asset URLs here.
            </Alert>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {state.uploadedAssets.map((asset) => (
                <UploadedAssetCard
                  key={asset.filename}
                  asset={asset}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
