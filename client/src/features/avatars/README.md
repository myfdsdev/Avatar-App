# avatars

Avatar library: list, edit, delete.

`AvatarDetail` (`/avatars/:id`) is one avatar's page, laid out like LemonSlice's agent page: Chat (a live call, via `features/call/useCall`) and Settings (`AvatarSettings` - visuals, greeting, voice, personality, behaviour). Settings save as they change through `useAutosave`; there is no Save button.
