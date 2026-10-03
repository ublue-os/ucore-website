# uCore

> uCore is an opinionated, container-first server operating system built on Fedora CoreOS. It ships as three bootable container images, each adding a layer of capability: `ucore-minimal` (container host), `ucore` (adds ZFS, Samba, NFS) and `ucore-hci` (adds KVM and libvirt).

- Images are published at `ghcr.io/ublue-os/<image>:<tag>`, for example `ghcr.io/ublue-os/ucore:stable`. Tags combine a release stream (`lts`, `stable`, `testing`) with an optional NVIDIA driver suffix (`-nvidia`, `-nvidia-lts`). Use only the full references listed on the homepage and in "Choosing an image".
- uCore changes Fedora CoreOS behavior: Zincati automatic updates and reboots are disabled. Prefer these guides over generic Fedora CoreOS advice for operating an installed system.
- The source of truth for images, builds and releases is the [ublue-os/ucore repository](https://github.com/ublue-os/ucore). Each page names the upstream revision it was checked against.
- Every page is also available as Markdown: replace the trailing slash of its URL with `.md` (the homepage is `/index.md`). The full text of all pages below is in [llms-full.txt](https://projectucore.org/llms-full.txt).
