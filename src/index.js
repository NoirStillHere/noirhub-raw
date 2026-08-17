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

        // Route: /game/:placeId -> proxy Roblox API để lấy tên + ảnh game (né CORS)
        const gameMatch = path.match(/^\/game\/([^/]+)\/?$/);
        if (gameMatch) {
            return handleGameLookup(gameMatch[1]);
        }

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

// ============================================
// LẤY TÊN + ẢNH GAME TỪ PLACE ID (proxy Roblox API)
// ============================================

async function handleGameLookup(placeId) {
    const jsonHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
    };

    if (!/^\d+$/.test(placeId)) {
        return new Response(JSON.stringify({ success: false, error: 'Place ID không hợp lệ (phải là số)' }), { status: 400, headers: jsonHeaders });
    }

    try {
        // Bước 1: placeId -> universeId
        const uRes = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
        if (!uRes.ok) {
            return new Response(JSON.stringify({ success: false, error: 'Không tìm thấy game với Place ID này' }), { status: 404, headers: jsonHeaders });
        }
        const uData = await uRes.json();
        const universeId = uData.universeId;
        if (!universeId) {
            return new Response(JSON.stringify({ success: false, error: 'Không tìm thấy game với Place ID này' }), { status: 404, headers: jsonHeaders });
        }

        // Bước 2: universeId -> tên game
        const gRes = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
        const gData = await gRes.json();
        const game = gData.data && gData.data[0];
        if (!game) {
            return new Response(JSON.stringify({ success: false, error: 'Không lấy được thông tin game' }), { status: 404, headers: jsonHeaders });
        }

        // Bước 3: lấy ảnh thumbnail game (không bắt buộc, lỗi thì bỏ qua)
        let thumbnail = null;
        try {
            const tRes = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png`);
            const tData = await tRes.json();
            thumbnail = tData.data && tData.data[0] ? tData.data[0].imageUrl : null;
        } catch (e) { /* bỏ qua nếu lỗi lấy ảnh */ }

        return new Response(JSON.stringify({
            success: true,
            name: game.name,
            universeId,
            placeId,
            playing: game.playing,
            thumbnail
        }), { status: 200, headers: jsonHeaders });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders });
    }
}
