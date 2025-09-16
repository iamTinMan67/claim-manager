-- Create exhibits table
CREATE TABLE IF NOT EXISTS exhibits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  exhibit_number INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, exhibit_number)
);

-- Enable RLS
ALTER TABLE exhibits ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own exhibits" ON exhibits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exhibits" ON exhibits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exhibits" ON exhibits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exhibits" ON exhibits
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_exhibits_user_id ON exhibits(user_id);
CREATE INDEX IF NOT EXISTS idx_exhibits_exhibit_number ON exhibits(user_id, exhibit_number);
