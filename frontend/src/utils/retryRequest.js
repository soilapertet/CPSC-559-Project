export async function retryRequest(fn, retries = 2, delay = 500) {

    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (err) {

            // Only retry on network or 5xx errors
            const status = err.response?.status;

            if (status && status < 500) {
                throw err;          // do not retry client errors
            }

            // Throw error if last attempt fails
            if (i === retries) {
                throw err;
            }

            // Wait before retrying request
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }
}