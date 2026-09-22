# avatars

Avatar library: list, edit, delete.

`AvatarDetail` (`/avatars/:id`) is one avatar's page, laid out like LemonSlice's agent page: Chat (a live call, via `features/call/useCall`) and Settings (`AvatarSettings` - visuals, greeting, voice, personality, behaviour). Settings save as they change through `useAutosave`; there is no Save button.

`KnowledgeBase` is the Personality card's document list: PDF, DOCX, TXT or MD, uploaded straight away rather than through autosave. The server keeps only the extracted text and adds it to the call's instructions (`server/src/ai/knowledge.js` has the size and context budgets).
