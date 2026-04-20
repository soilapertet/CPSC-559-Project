export async function retryRequest(fn, retries = 2, delay = 500) {

    let lastError;

    for(let i = 0; i <= retries; i++) {
        try {
            await fn();
        } catch(err) {

            lastError = err;

            // Only retry on network or 5xx errors
            const status = err.response?.status;

            if(status && status < 500) {
                throw err;          // do not retry client errors
            }

            if(i < retries) {
                await new Promise(res => setTimeout(res, delay));
                delay *= 2;
            }
        }
    }

    throw lastError;
}