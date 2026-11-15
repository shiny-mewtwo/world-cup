"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Share2,
} from "lucide-react";

type NativeShareMode = "file" | "url";

type EntryShareButtonProps = {
  fileName: string;
  imagePath: string;
  title: string;
};

function getAbsoluteImageUrl(imagePath: string) {
  return new URL(imagePath, window.location.href).href;
}

function getNativeShareMode(fileName: string): NativeShareMode | null {
  if (!navigator.share) {
    return null;
  }

  if (typeof navigator.canShare === "function" && typeof File === "function") {
    const testFile = new File([""], fileName, { type: "image/png" });

    if (navigator.canShare({ files: [testFile] })) {
      return "file";
    }
  }

  return "url";
}

export function EntryShareButton({
  fileName,
  imagePath,
  title,
}: EntryShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [nativeShareMode, setNativeShareMode] = useState<NativeShareMode | null>(null);
  const [canCopyLink, setCanCopyLink] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const menuId = `entry-share-menu-${fileName.replace(/[^a-z0-9-]/gi, "-")}`;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        shareRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function shareNative() {
    if (!navigator.share || !nativeShareMode) {
      return;
    }

    setIsWorking(true);
    setStatusMessage(null);

    try {
      const url = getAbsoluteImageUrl(imagePath);

      if (nativeShareMode === "file") {
        const response = await fetch(imagePath);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: blob.type || "image/png" });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title,
          });
          setIsOpen(false);
          return;
        }
      }

      await navigator.share({
        title,
        url,
      });
      setIsOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setStatusMessage("Sharing did not complete.");
    } finally {
      setIsWorking(false);
    }
  }

  async function copyLink() {
    setIsWorking(true);
    setStatusMessage(null);

    try {
      await navigator.clipboard.writeText(getAbsoluteImageUrl(imagePath));
      setStatusMessage("Link copied");
    } catch {
      setStatusMessage("Copy failed");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="entry-share" ref={shareRef}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        className="button icon-text-button"
        type="button"
        onClick={() => {
          setNativeShareMode(getNativeShareMode(fileName));
          setCanCopyLink(Boolean(navigator.clipboard));
          setIsOpen((current) => !current);
          setStatusMessage(null);
        }}
      >
        <Share2 aria-hidden="true" size={18} />
        Share picks
      </button>

      {isOpen ? (
        <div className="entry-share-menu" id={menuId}>
          {nativeShareMode ? (
            <button
              className="entry-share-option"
              disabled={isWorking}
              type="button"
              onClick={shareNative}
            >
              <Share2 aria-hidden="true" size={17} />
              {nativeShareMode === "file" ? "Share photo" : "Share link"}
            </button>
          ) : null}
          <a
            className="entry-share-option"
            download={fileName}
            href={imagePath}
            onClick={() => setIsOpen(false)}
          >
            <Download aria-hidden="true" size={17} />
            Save photo
          </a>
          <a
            className="entry-share-option"
            href={imagePath}
            rel="noreferrer"
            target="_blank"
            onClick={() => setIsOpen(false)}
          >
            <ExternalLink aria-hidden="true" size={17} />
            Open image
          </a>
          <button
            className="entry-share-option"
            disabled={isWorking || !canCopyLink}
            type="button"
            onClick={copyLink}
          >
            {statusMessage === "Link copied" ? (
              <Check aria-hidden="true" size={17} />
            ) : (
              <Copy aria-hidden="true" size={17} />
            )}
            Copy link
          </button>
          {statusMessage ? (
            <div className="entry-share-status" role="status">
              {statusMessage}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
