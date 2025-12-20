const _manifest = new Map();
const _images = new Map();
const _promises = new Map();

function _loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
}

const Assets = {
    register(key, url) {
        if (!key || !url) throw new Error("Assets.register requires key and url");
        _manifest.set(String(key), String(url));
    },

    registerAll(map) {
        if (!map) return;
        for (const [key, url] of Object.entries(map)) {
            this.register(key, url);
        }
    },

    getImage(key) {
        return _images.get(String(key)) || null;
    },

    async loadImage(key) {
        const k = String(key);
        if (_images.has(k)) return _images.get(k);
        if (_promises.has(k)) return _promises.get(k);

        const url = _manifest.get(k);
        if (!url) throw new Error(`Unknown image asset key: ${k}`);

        const p = _loadImage(url).then((img) => {
            _images.set(k, img);
            _promises.delete(k);
            return img;
        }).catch((err) => {
            _promises.delete(k);
            throw err;
        });

        _promises.set(k, p);
        return p;
    },

    async preload(keys) {
        const list = Array.isArray(keys) ? keys : [];
        await Promise.all(list.map((k) => this.loadImage(k)));
    }
};

export default Assets;

