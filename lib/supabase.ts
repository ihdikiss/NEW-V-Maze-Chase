
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sogywxbavcwtbtcirvsw.supabase.co';
const supabaseKey = 'sb_publishable_svYdUF0MDpCbpjZ2jyAPww_1UlwAtAV';

export const supabase = createClient(supabaseUrl, supabaseKey);
