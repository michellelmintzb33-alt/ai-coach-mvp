import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 仅在有 URL 时初始化，避免构建时由于环境未就绪报错
export const supabase = supabaseUrl
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
