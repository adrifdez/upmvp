import type { ChatResponse, GuidelinesResponse, Guideline, DualChatResponse } from '@/types';

class ApiClient {
    async sendMessage(message: string, sessionId: string | null, matchingMethod: 'text' | 'vector' = 'vector', hybridWeight?: number): Promise<ChatResponse> {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                sessionId,
                matchingMethod,
                hybridWeight
            }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
    }

    async sendMessageDual(message: string, sessionId: string | null, hybridWeight?: number): Promise<DualChatResponse> {
        // Track response times individually
        const responseTimes: DualChatResponse['responseTimes'] = {};
        
        // Wrap each method call with timing logic
        const textPromise = (async () => {
            const startTime = Date.now();
            try {
                const response = await this.sendMessage(message, sessionId, 'text');
                return response;
            } catch (error) {
                throw error;
            } finally {
                responseTimes.text = Date.now() - startTime;
            }
        })();
        
        const vectorPromise = (async () => {
            const startTime = Date.now();
            try {
                const response = await this.sendMessage(message, sessionId, 'vector', hybridWeight);
                return response;
            } catch (error) {
                throw error;
            } finally {
                responseTimes.vector = Date.now() - startTime;
            }
        })();
        
        // Use allSettled to get results from both methods even if one fails
        const [textResult, vectorResult] = await Promise.allSettled([textPromise, vectorPromise]);
        
        // Extract responses and errors
        const textResponse = textResult.status === 'fulfilled' ? textResult.value : null;
        const vectorResponse = vectorResult.status === 'fulfilled' ? vectorResult.value : null;
        
        // Build error object if any method failed
        const errors: DualChatResponse['error'] = {};
        if (textResult.status === 'rejected') {
            errors.text = textResult.reason instanceof Error ? textResult.reason.message : String(textResult.reason);
        }
        if (vectorResult.status === 'rejected') {
            errors.vector = vectorResult.reason instanceof Error ? vectorResult.reason.message : String(vectorResult.reason);
        }

        // Determine sessionId from successful responses or use provided one
        const finalSessionId = sessionId || 
                             textResponse?.session_id || 
                             vectorResponse?.session_id || 
                             '';

        // If both methods failed, throw an error
        if (!textResponse && !vectorResponse) {
            const errorMessage = `Both methods failed. Text: ${errors.text || 'Unknown error'}, Vector: ${errors.vector || 'Unknown error'}`;
            throw new Error(errorMessage);
        }

        return {
            text: textResponse,
            vector: vectorResponse,
            message,
            sessionId: finalSessionId,
            responseTimes,
            ...(Object.keys(errors).length > 0 && { error: errors })
        };
    }

    async getGuidelines(): Promise<GuidelinesResponse> {
        const response = await fetch('/api/guidelines');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
    }

    async createGuideline(guideline: Partial<Guideline>): Promise<Guideline> {
        const response = await fetch('/api/guidelines', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(guideline),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
    }

    async searchGuidelines(query: string): Promise<GuidelinesResponse> {
        const response = await fetch(`/api/guidelines/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
    }
}

export const api = new ApiClient();