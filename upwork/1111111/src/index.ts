import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { renderSemesterPlan, RenderData } from '../semesterschedule-pdf';

const app = express();
const port = 3000;

// Enable CORS for all routes
app.use(cors());

// Optionally, configure CORS with specific settings
// app.use(cors({
//   origin: 'http://your-frontend-domain.com', // Replace with your front-end domain
//   methods: 'GET,POST', // Allowed methods
//   allowedHeaders: 'Content-Type,Authorization', // Allowed headers
// }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// POST route to generate and return a PDF
app.post('/generate-pdf', async (req: Request, res: Response) => {
    try {
        const data: RenderData = req.body; // Ensure data matches RenderData type

        // Call renderSemesterPlan with req, res, and data
        await renderSemesterPlan(req, res, data);
    } catch (error) {
        console.error(`Error generating PDF ${error.message}`);
        res.status(500).send(`Error generating PDF ${error.message}`);
    }
});

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'src')));

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
