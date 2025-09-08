import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Supabase client using SERVICE_KEY for admin privileges
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Middleware: verify JWT token from frontend
async function authenticate(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const { data: user, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    req.user = user;
    next();
}

// Get all products
app.get('/products', authenticate, async (req, res) => {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('createdAt', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Add a new product
app.post('/products', authenticate, async (req, res) => {
    const { name, description, status, images } = req.body;
    const newProduct = {
        name,
        description,
        status,
        images,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const { data, error } = await supabase.from('products').insert([newProduct]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// Update product
app.put('/products/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { name, description, status, images } = req.body;

    const { data, error } = await supabase
        .from('products')
        .update({ name, description, status, images, updatedAt: new Date().toISOString() })
        .eq('id', id)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

// Delete product
app.delete('/products/:id', authenticate, async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
});


// Overview stats
app.get('/overview', authenticate, async (req, res) => {
    const { data, error } = await supabase
        .from('products')
        .select('status, images, createdAt, updatedAt');

    if (error) return res.status(500).json({ error: error.message });

    const totalProducts = data.length;
    const activeProducts = data.filter(p => p.status === 'active').length;
    const totalImages = data.reduce((sum, p) => sum + (p.images?.length || 0), 0);

    // Find the latest updatedAt or createdAt
    let lastUpdated = null;
    if (data.length > 0) {
        lastUpdated = data
            .map(p => new Date(p.updatedAt || p.createdAt))
            .sort((a, b) => b - a)[0]
            .toISOString();
    }

    res.json({
        totalProducts,
        activeProducts,
        totalImages,
        lastUpdated
    });
});


app.listen(3000, () => console.log('Backend running on http://localhost:3000'));
