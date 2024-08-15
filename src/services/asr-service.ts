import EventEmitter from 'events';
import speech, { protos } from '@google-cloud/speech';

/*
* This class provides ASR support for the incoming audio from the Client.
* The following events are expected from the session:
* 
*   Name; error
*   Parameters: Error message string or error object.
* 
*   Name: transcript
*   Parameters: `Transcript` object.
* 
*   Name: final-transcript
*   Parameters: `Transcript` object.
* 
* The current usage of this class requires that a new instance be created once
* the final transcript has been received.
*/
export class ASRService {
    private recognizeStream: NodeJS.WritableStream | null = null;
    private emitter = new EventEmitter();
    private state = 'None';
    private byteCount = 0;
    private processingText = false;

    public ASRService() {
        const client = new speech.SpeechClient();
        const request = {
            config: {
            encoding: 'LINEAR16' as const, // Explicitly cast to enum value
            sampleRateHertz: 16000,
            languageCode: 'en-US',
            },
            interimResults: true,
        };
        this.recognizeStream = client.streamingRecognize(request);
        this.recognizeStream.on('data', (data) => {
            var audioText = '';
            const results = data.results || [];
            for (const result of results) {
                const transcript = result.alternatives[0].transcript;
                console.log(`Transcription: ${transcript}`);
                audioText += transcript;
            }

            this.state = 'Complete';
            this.emitter.emit('final-transcript', {
                text: audioText,
                confidence: 1.0
            });
        });
        this.recognizeStream.on('error', (error) => {
            console.error('Error during speech recognition:', error);
        });
        
        this.recognizeStream.on('end', () => {
            console.log('Speech recognition ended');
            this.processingText = false;
        });
        console.log('Initial Speech complete');
    }

    on(event: string, listener: (...args: any[]) => void): ASRService {
        this.emitter?.addListener(event, listener);
        return this;
    }

    getState(): string {
        return this.state;
    }

    /*
    * For this implementation, we are just going to count the number of bytes received.
    * Once we get "enough" bytes, we'll treat this as a completion. In a real-world
    * scenario, an actual ASR engine should be invoked to process the audio bytes.
    */
    processAudio(data: Uint8Array): ASRService {
        if (this.state === 'Complete') {
            this.emitter.emit('error', 'Speech recognition has already completed.');
            return this;
        }

        if(this.recognizeStream != null) {
            console.log('Write Chunk!!!');
            this.recognizeStream.write(data);
        }
        this.byteCount += data.length;
        console.log('byteCount:', this.byteCount);

        /*
        * If we get enough audio bytes, mark this instance as complete, send out the event,
        * and reset the count to help prevent issues if this instance is attempted to be reused.
        * 
        * 40k bytes equates to 5 seconds of 8khz PCMU audio.
        */
        if (this.byteCount >= 40000 && this.processingText === false) {

            if(this.recognizeStream != null) {
                console.log('End Chunk!!!');
                this.recognizeStream.end();
            }
            this.processingText = true;
            
            this.byteCount = 0;
            return this;
        }
        
        this.state = 'Processing';
        return this;
    }
}

export class Transcript {
    text: string;
    confidence: number;

    constructor(text: string, confidence: number) {
        this.text = text;
        this.confidence = confidence;
    }
}