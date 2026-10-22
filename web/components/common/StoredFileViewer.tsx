"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import useAxiosAuth from "@/hooks/useAxiosAuth";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Callout, Skeleton } from "@/components/ui/feedback";
import { StoredFileLink } from "@/lib/files";

/**
 * Shows a privately stored file, such as a shipment document or a payment
 * proof. The file comes through a link the API signs for a few minutes, only
 * for shipment parties.
 */
export function StoredFileViewer({
  title,
  description,
  endpoint,
  cacheKey,
  enabled = true,
  onClose,
  actions,
}: {
  title: string;
  description?: string;
  /** API path that returns a signed link for the file. */
  endpoint: string;
  /** Identifies the stored file; change it when the file is replaced. */
  cacheKey: unknown[];
  enabled?: boolean;
  onClose: () => void;
  /** Footer buttons beside "Open in new tab"; a Close button is shown when absent. */
  actions?: React.ReactNode;
}) {
  const axios = useAxiosAuth();

  const { data: link, isLoading, isError, error } = useQuery({
    queryKey: ["stored-file", ...cacheKey],
    enabled,
    // Signed links last five minutes; refresh before they lapse.
    staleTime: 4 * 60 * 1000,
    gcTime: 4 * 60 * 1000,
    retry: false,
    queryFn: async () => (await axios.get(endpoint)).data.data as StoredFileLink,
  });

  const isImage = link?.mimeType.startsWith("image/");
  const message =
    (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ??
    "Try again in a moment.";

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={title}
      description={description}
      footer={
        <>
          {link && (
            <Button variant="outline" asChild className="sm:mr-auto">
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Open in new tab
              </a>
            </Button>
          )}
          {actions ?? (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </>
      }
    >
      {isLoading ? (
        <Skeleton className="h-[60vh] w-full rounded-inset" />
      ) : isError || !link ? (
        <Callout tone="danger" title="We couldn't open this file">
          {message}
        </Callout>
      ) : isImage ? (
        // A short-lived signed URL: not something to route through the image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.url}
          alt={`${title}: ${link.fileName}`}
          className="mx-auto max-h-[65vh] w-auto rounded-inset border border-line/70 object-contain"
        />
      ) : (
        <iframe
          src={link.url}
          title={`${title}: ${link.fileName}`}
          className="h-[65vh] w-full rounded-inset border border-line/70 bg-surface-muted"
        />
      )}
    </Dialog>
  );
}
