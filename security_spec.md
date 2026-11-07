# Firestore Security Specification — Brand Builder (The Plot Witch Studio)

## 1. Data Invariants
- All Brand Builder application state (campaigns, master anchor images, generated sizes, brand presets, and content calendar entries) is stored under a server-computed cryptographic 64-character SHA-256 hex workspace key (`studioId`) at `/studios/{studioId}` and `/studios/{studioId}/imageChunks/{chunkId}`.
- The `studioId` path variable MUST match `^[a-f0-9]{32,64}$`, and every document's `studioId` field MUST equal the path `{studioId}` and remain immutable across updates.
- Every document write (`create` and `update`) is validated by strict schema helpers (`isValidStudioWorkspace` and `isValidImageChunk`) enforcing `keys().hasAll(...)`, `keys().hasOnly(...)`, and explicit string `.size()` boundaries.
- Image chunks are capped at `700,000` characters per document to prevent 1MB document limit failures or Denial-of-Wallet resource exhaustion.

## 2. The "Dirty Dozen" Payloads (Rejected by Rules)
1. **Unbounded Studio ID Injection**: `studioId` with 2,000 characters or non-hex characters -> `PERMISSION_DENIED`.
2. **Mismatched `studioId` Field**: Writing `data.studioId != studioId` in `/studios/{studioId}` -> `PERMISSION_DENIED`.
3. **Immutable `studioId` Tampering**: Updating `studioId` on an existing `/studios/{studioId}` document -> `PERMISSION_DENIED`.
4. **Shadow / Ghost Field Injection on Create**: Creating `/studios/{studioId}` with extra key `isAdmin: true` -> `PERMISSION_DENIED` (`hasOnly` check).
5. **Shadow / Ghost Field Injection on Update**: Updating `/studios/{studioId}` with `affectedKeys` outside allowed workspace fields -> `PERMISSION_DENIED`.
6. **Oversized `scheduledPostsJson` Payload**: Sending a 900KB string in `scheduledPostsJson` (exceeds `400000` limit) -> `PERMISSION_DENIED`.
7. **Invalid Type on `isAnchorApproved`**: Sending a string `"yes"` instead of `bool` for `isAnchorApproved` -> `PERMISSION_DENIED`.
8. **Orphaned ImageChunk Without Parent Studio**: Creating `/studios/{studioId}/imageChunks/{chunkId}` when `/studios/{studioId}` does not exist -> `PERMISSION_DENIED`.
9. **Oversized ImageChunk**: Sending `dataChunk` > `700,000` characters -> `PERMISSION_DENIED`.
10. **Negative or Out-of-Range `chunkIndex`**: Sending `chunkIndex < 0` or `chunkIndex >= 64` -> `PERMISSION_DENIED`.
11. **Invalid `chunkId` Path Variable**: `chunkId` containing spaces or special characters outside `^[a-zA-Z0-9_\-]+$` -> `PERMISSION_DENIED`.
12. **Blanket Root Collection Access**: Attempting to read or write any path outside `/studios/{studioId}` -> `PERMISSION_DENIED` via default-deny catch-all.
