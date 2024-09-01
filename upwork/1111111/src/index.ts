import express from 'express';
import { renderSemesterPlan } from './semesterschedule-pdf';
import path from 'path';
import { RenderData } from './semesterschedule-pdf';

const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.post('/generate-pdf', (req, res) => {
  const data: RenderData = req.body; // Assuming the RenderData is sent in the request body
  renderSemesterPlan(req, res, data);
});

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'src')));

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
