import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://crxmeczwvopzvmjllqkb.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeG1lY3p3dm9wenZtamxscWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MzEwOTQsImV4cCI6MjA5MzUwNzA5NH0.ENQobby_jgIMM5I2otZrPmSQIyPYQDmnlp2e7HiFPzM"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)