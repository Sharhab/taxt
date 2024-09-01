import express from 'express';
import cors from 'cors';
import { renderSemesterPlan } from './semesterschedule-pdf';
import path from 'path';
import { RenderData } from './semesterschedule-pdf';

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
app.post('/generate-pdf', async (req, res) => {
    try {
        const data: RenderData = req.body; // Ensure data matches RenderData type

        // Generate the PDF (assuming renderSemesterPlan returns a buffer or stream)
        const pdfBuffer = await renderSemesterPlan(data);

        // Set headers for the response to handle the PDF correctly
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="semester_plan.pdf"');
        
        // Send the generated PDF buffer as the response
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF');
    }
});

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'src')));

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
