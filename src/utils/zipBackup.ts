import {
  AssetCopyDraft,
  BrandBrief,
  BrandPreset,
  CanonicalProductSpec,
  GeneratedMediumShot,
  SavedProductListing,
  ScheduledPost,
} from "../types/brand";
import { CAMPAIGN_MEDIUMS, OFFICIAL_PLOT_WITCH_VOICE_GUIDE_TEXT } from "../data/campaignPresets";
import { formatExportFilename } from "./imageExport";

interface ZipEntryInput {
  filename: string;
  data: Uint8Array;
}

export interface FullBrandBuilderStateBackup {
  activePresetId?: string;
  activeTemplateId?: string;
  isAnchorApproved?: boolean;
  activeBrandPreset?: BrandPreset;
  savedPresets?: BrandPreset[];
  savedListings?: SavedProductListing[];
  scheduledPosts?: ScheduledPost[];
  brief?: BrandBrief;
  canonicalSpec?: CanonicalProductSpec;
  anchorImageUrl?: string;
  mediumShots?: Record<string, GeneratedMediumShot>;
  copyDraft?: AssetCopyDraft;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipArchive(entries: ZipEntryInput[]): Blob {
  const encoder = new TextEncoder();
  const localFileParts: Uint8Array[] = [];
  const centralDirParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.filename);
    const dataBytes = entry.data;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true); // Local file header signature
    localView.setUint16(4, 20, true); // Version needed to extract
    localView.setUint16(6, 0x0800, true); // UTF-8 filename flag
    localView.setUint16(8, 0, true); // Compression method: 0 (Store)
    localView.setUint16(10, 0, true); // File last mod time
    localView.setUint16(12, 0x5421, true); // File last mod date
    localView.setUint32(14, crc, true); // CRC-32
    localView.setUint32(18, size, true); // Compressed size
    localView.setUint32(22, size, true); // Uncompressed size
    localView.setUint16(26, nameBytes.length, true); // File name length
    localView.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    localFileParts.push(localHeader, dataBytes);

    // Central directory file header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true); // Central file header signature
    centralView.setUint16(4, 20, true); // Version made by
    centralView.setUint16(6, 20, true); // Version needed to extract
    centralView.setUint16(8, 0x0800, true); // UTF-8 flag
    centralView.setUint16(10, 0, true); // Compression method: 0 (Store)
    centralView.setUint16(12, 0, true); // Last mod time
    centralView.setUint16(14, 0x5421, true); // Last mod date
    centralView.setUint32(16, crc, true); // CRC-32
    centralView.setUint32(20, size, true); // Compressed size
    centralView.setUint32(24, size, true); // Uncompressed size
    centralView.setUint16(28, nameBytes.length, true); // Filename length
    centralView.setUint16(30, 0, true); // Extra field length
    centralView.setUint16(32, 0, true); // File comment length
    centralView.setUint16(34, 0, true); // Disk number start
    centralView.setUint16(36, 0, true); // Internal file attributes
    centralView.setUint32(38, 0, true); // External file attributes
    centralView.setUint32(42, offset, true); // Relative offset of local header
    centralHeader.set(nameBytes, 46);

    centralDirParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  let centralDirSize = 0;
  for (const part of centralDirParts) {
    centralDirSize += part.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true); // Number of this disk
  eocdView.setUint16(6, 0, true); // Disk where central directory starts
  eocdView.setUint16(8, entries.length, true); // Number of central dir records on this disk
  eocdView.setUint16(10, entries.length, true); // Total number of central dir records
  eocdView.setUint32(12, centralDirSize, true); // Size of central directory
  eocdView.setUint32(16, offset, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true); // Comment length

  return new Blob(
    [...localFileParts, ...centralDirParts, eocd] as unknown as BlobPart[],
    {
      type: "application/zip",
    }
  );
}

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    return null;
  }
}

export async function exportBrandBuilderBackupZip(params: {
  activePresetId: string;
  activeTemplateId: string;
  isAnchorApproved: boolean;
  activeBrandPreset: BrandPreset;
  savedPresets: BrandPreset[];
  savedListings: SavedProductListing[];
  scheduledPosts: ScheduledPost[];
  brief: BrandBrief;
  canonicalSpec: CanonicalProductSpec;
  anchorImageUrl: string;
  mediumShots: Record<string, GeneratedMediumShot>;
  copyDraft: AssetCopyDraft;
}): Promise<void> {
  const encoder = new TextEncoder();
  const entries: ZipEntryInput[] = [];

  const fullBackupManifest = {
    exportedAt: new Date().toISOString(),
    appTitle: "Brand Builder — The Plot Witch",
    activePresetId: params.activePresetId,
    activeTemplateId: params.activeTemplateId,
    isAnchorApproved: params.isAnchorApproved,
    activeBrandPreset: params.activeBrandPreset,
    savedPresets: params.savedPresets,
    savedListings: params.savedListings,
    scheduledPosts: params.scheduledPosts,
    currentWorkspace: {
      brief: params.brief,
      canonicalSpec: params.canonicalSpec,
      anchorImageUrl: params.anchorImageUrl,
      mediumShots: params.mediumShots,
      copyDraft: params.copyDraft,
    },
  };

  entries.push({
    filename: "brand_builder_backup.json",
    data: encoder.encode(JSON.stringify(fullBackupManifest, null, 2)),
  });

  entries.push({
    filename: "calendar_scheduled_posts.json",
    data: encoder.encode(JSON.stringify(params.scheduledPosts, null, 2)),
  });

  entries.push({
    filename: "tasha_driver_informative_voice_guide.txt",
    data: encoder.encode(OFFICIAL_PLOT_WITCH_VOICE_GUIDE_TEXT),
  });

  // Include master anchor image file if available
  const anchorBytes = await fetchImageBytes(params.anchorImageUrl);
  if (anchorBytes) {
    const masterFilename = formatExportFilename(
      params.brief.productName || params.brief.brandName,
      "master_image",
      1080,
      1080
    );
    entries.push({
      filename: `images/${masterFilename}`,
      data: anchorBytes,
    });
  }

  // Include completed medium image files
  for (const medium of CAMPAIGN_MEDIUMS) {
    const shot = params.mediumShots[medium.id];
    if (shot?.status === "completed" && shot.imageUrl) {
      const imgBytes = await fetchImageBytes(shot.imageUrl);
      if (imgBytes) {
        const fname = formatExportFilename(
          params.brief.productName || params.brief.brandName,
          medium.slug,
          medium.targetWidth,
          medium.targetHeight
        );
        entries.push({
          filename: `images/${fname}`,
          data: imgBytes,
        });
      }
    }
  }

  const zipBlob = createZipArchive(entries);
  const blobUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = blobUrl;
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.download = `brand_builder_backup_${dateStamp}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
}

/**
 * Parses a backup .zip (or .json) file and extracts the saved Brand Builder state.
 * Supports both Store (method 0) and Deflate (method 8, via DecompressionStream) ZIP entries.
 */
export async function parseBrandBuilderBackupZip(
  file: File
): Promise<FullBrandBuilderStateBackup> {
  const decoder = new TextDecoder("utf-8");

  // If the user selects a raw .json backup file directly
  if (file.name.toLowerCase().endsWith(".json")) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return normalizeParsedBackupJson(parsed);
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  let pos = 0;
  const extractedTextFiles: Record<string, string> = {};

  while (pos + 30 <= bytes.length) {
    const sig = view.getUint32(pos, true);
    if (sig !== 0x04034b50) {
      break;
    }

    const compressionMethod = view.getUint16(pos + 8, true);
    const compressedSize = view.getUint32(pos + 18, true);
    const fileNameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);

    const nameBytes = bytes.subarray(pos + 30, pos + 30 + fileNameLen);
    const fileName = decoder.decode(nameBytes);

    const dataStart = pos + 30 + fileNameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) break;

    const rawSlice = bytes.subarray(dataStart, dataEnd);

    if (fileName.endsWith(".json")) {
      if (compressionMethod === 0) {
        extractedTextFiles[fileName] = decoder.decode(rawSlice);
      } else if (
        compressionMethod === 8 &&
        typeof DecompressionStream !== "undefined"
      ) {
        try {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          writer.write(rawSlice as unknown as BufferSource);
          writer.close();
          const decompressedBuf = await new Response(ds.readable).arrayBuffer();
          extractedTextFiles[fileName] = decoder.decode(
            new Uint8Array(decompressedBuf)
          );
        } catch {
          // Ignore decompression failure for non-manifest files
        }
      }
    }

    pos = dataEnd;
  }

  const manifestText =
    extractedTextFiles["brand_builder_backup.json"] ||
    Object.values(extractedTextFiles)[0];

  if (!manifestText) {
    throw new Error(
      "Could not find brand_builder_backup.json inside the backup archive."
    );
  }

  const parsed = JSON.parse(manifestText);
  return normalizeParsedBackupJson(parsed);
}

function normalizeParsedBackupJson(parsed: any): FullBrandBuilderStateBackup {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup file format.");
  }

  const workspace = parsed.currentWorkspace || {};
  return {
    activePresetId:
      parsed.activePresetId || parsed.activeBrandPreset?.id || undefined,
    activeTemplateId: parsed.activeTemplateId || undefined,
    isAnchorApproved:
      typeof parsed.isAnchorApproved === "boolean"
        ? parsed.isAnchorApproved
        : true,
    activeBrandPreset: parsed.activeBrandPreset || undefined,
    savedPresets: Array.isArray(parsed.savedPresets)
      ? parsed.savedPresets
      : undefined,
    savedListings: Array.isArray(parsed.savedListings)
      ? parsed.savedListings
      : undefined,
    scheduledPosts: Array.isArray(parsed.scheduledPosts)
      ? parsed.scheduledPosts
      : Array.isArray(parsed)
      ? parsed
      : undefined,
    brief: workspace.brief || parsed.brief || undefined,
    canonicalSpec: workspace.canonicalSpec || parsed.canonicalSpec || undefined,
    anchorImageUrl:
      workspace.anchorImageUrl || parsed.anchorImageUrl || undefined,
    mediumShots: workspace.mediumShots || parsed.mediumShots || undefined,
    copyDraft: workspace.copyDraft || parsed.copyDraft || undefined,
  };
}
