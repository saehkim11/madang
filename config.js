// Supabase Dashboard의 Project Settings > API에서 값을 복사해 붙여 넣으세요.
const SUPABASE_URL = "https://orbqmlzfizqhpoqvjftq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_siSuY4yKMjkKAzOsAPdmyQ_eDq3zSPy";

// 브라우저에서 사용할 Supabase 클라이언트입니다.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
