# avatars

Avatar CRUD. Creation flows (photo upload, video training) live in `studio/`.

Pattern: `repository` owns queries and is always workspace-scoped, `service`
owns rules, `controller` owns HTTP, `routes` owns wiring, `validation` owns
input shapes.
