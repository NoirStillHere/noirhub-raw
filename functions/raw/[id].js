// Cloudflare Pages Function - GET /raw/:id
// Lấy code script từ Firestore (REST API) và trả về dạng text thuần,
// y hệt hành vi raw.html của trang chính nhưng chạy trên domain .pages.dev riêng.

const PROJECT_ID = 'noirscripthub';

export async function onRequestGet(context) {
    const { id } = context.params;
    const textHeaders = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' };

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

        // rawEnabled mặc định true nếu field không tồn tại (script cũ trước khi có tính năng này)
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
