import express from 'express';
import {register} from './metrics';

const app = express();

// Expose metrics at the /metrics endpoint
app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', register.contentType);
    res.send(await register.metrics());
});

// Start the server
export const startMetricsServer = (PORT: number) => {
    app.listen(PORT, () => {
        console.log(`Metrics server running at http://localhost:${PORT}/metrics`);
    });
};
