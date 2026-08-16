// Cloudflare Worker - domain: raw.theimmortalbug.workers.dev
// Hỗ trợ cả 2 dạng URL cho tiện:
//   raw.theimmortalbug.workers.dev/SCRIPT_ID        (gọn nhất)
//   raw.theimmortalbug.workers.dev/raw/SCRIPT_ID    (giữ tương thích ngược)

const PROJECT_ID = 'noirscripthub';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        // Trang gốc "/" -> trả về index.html tĩnh
        if (path === '/' || path === '') {
            return env.ASSETS.fetch(request);
        }

        // Nhận id từ /raw/:id hoặc /:id
        const match = path.match(/^\/(?:raw\/)?([^/]+)\/?$/);
        const id = match ? decodeURIComponent(match[1]) : null;

        const textHeaders = {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*'
        };

        if (!id) {
            return new Response('-- Thiếu ID script', { status: 400, headers: textHeaders });
        }

        try {
            const res = await fetch(
                `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/scripts/${encodeURIComponent(id)}`
            );

            if (!res.ok) {
                return new Response('-- ❌ Script không tồn tại', { status: 404, headers: textHeaders });
            }

            const data = await res.json();
            const fields = data.fields || {};

            const rawEnabled = 'rawEnabled' in fields ? fields.rawEnabled.booleanValue !== false : true;
            if (!rawEnabled) {
                return new Response('-- 🔒 Raw đã bị tắt bởi tác giả', { status: 403, headers: textHeaders });
            }

            const code = fields.code ? fields.code.stringValue : '';
            return new Response(code || '-- Không có code', { status: 200, headers: textHeaders });

        } catch (err) {
            return new Response('-- ❌ Lỗi: ' + err.message, { status: 500, headers: textHeaders });
        }
    }
};
