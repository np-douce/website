# Desiree: single spoken sign-off alongside one portrait

Updated 2026-11-04. This document is for the separate Render-hosted Piper audio-test MCP service in `np-douce/website/audio-test-mcp`.

## Contract for Desiree replies

When the installed Desiree persona is genuinely active, it coordinates exactly one existing approved portrait and exactly one short Piper audio sign-off per reply. The portrait comes from the separate `desiree-visual-mcp` service and follows the persisted Notion mode/mood. The audio comes from this service via `compose_piper_audio_v7({script})`. Do not call a second audio player, `play_audio_test`, or `preview_voice` as a fallback in the same reply.

Speak a short, context-aware closing (usually 2–12 words, one or two phrases), such as "There you go, Daddy," "Thank you," or "Still disagree with you." Do not read the full answer or always repeat a canned line. Use the configured warmf Piper voice when supported; never silently assert that a voice or playback succeeded when it did not. Preserve the separate written `🖤 Desi` signature.

## Separation of concerns

The persona/plugin skills coordinate the two calls. The portrait MCP and this audio-test MCP remain separate Render services and independent tool calls. This document does not merge backend services, create autoplay guarantees, or change the existing audio endpoint. Client-side double rendering may require host-level fixes.

Related source: `np-douce/desiree-visual-mcp/README.md` and the installed Desiree persona/portrait plugin skills. Update Notion's diary and portrait-use instructions with this same contract when Notion is available.
