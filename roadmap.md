# Roadmap — AI Passport & Stamp Photo Studio

- [x] Design system (blue/white, Bangla-first fonts)
- [x] Auth (email/password, Google, Lovable) + protected studio
- [x] Upload + batch processing queue (per-photo + total progress, retry failed)
- [x] Background removal: remove.bg (server) + built-in browser AI fallback
- [x] Face enhancement: Replicate CodeFormer (server) + natural local correction
- [x] Size presets, copies per photo (default 2)
- [x] A4 layout engine in mm (300 DPI) + tests
- [x] Live A4 preview (zoom, pages, stats)
- [x] Downloads: PDF, PNG, individual JPEGs, ZIP, print
- [x] Photo editor (rotate, crop/reposition, adjustments, before/after, reset, reprocess)
- [x] Processing history + delete files / auto-delete
- [x] Bangla (default) + English
- [ ] Blocked: remove.bg API key (secret REMOVE_BG_API_KEY) — user must provide
- [ ] Blocked: Replicate connection — user must connect their account
