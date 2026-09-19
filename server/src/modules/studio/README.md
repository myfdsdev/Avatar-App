# studio

Avatar creation flows. Plain CRUD lives in `avatars/`.

Ordering matters here: the upload must be stored and publicly addressable
before the vendor is called, because vendors fetch the image themselves. The
service refuses the combination of a real vendor and a storage driver whose
URLs are not publicly reachable, rather than letting it fail at the vendor.
