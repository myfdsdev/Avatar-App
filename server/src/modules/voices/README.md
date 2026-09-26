# voices

The workspace's own (custom) voices.

A voice is cloned in the LiveKit Cloud dashboard (Voices → Custom voices) from
about 10 seconds of clear speech; LiveKit has no public API for that step. Its
`v_*` id is then added here with a name, and appears in every avatar's voice
picker under "Your voices".

Calls with a custom voice speak through `CUSTOM_VOICE_TTS_MODEL` (default
`cartesia/sonic-3`), because the install's default Inworld model need not
support clones. Custom voices need a paid LiveKit Cloud plan.

- `GET    /api/voices`            list
- `POST   /api/voices`            `{ name, voiceId, gender?, language? }`
- `DELETE /api/voices/:voiceId`   remove the label (avatars using it keep working)
