import EventEmitter from 'events';
import { SpeechClient } from '@google-cloud/speech';

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
    private emitter = new EventEmitter();
    private state = 'None';
    private byteCount = 0;

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

        this.byteCount += data.length;
        console.log('byteCount:', this.byteCount);

        /*
        * If we get enough audio bytes, mark this instance as complete, send out the event,
        * and reset the count to help prevent issues if this instance is attempted to be reused.
        * 
        * 40k bytes equates to 5 seconds of 8khz PCMU audio.
        */
        if (this.byteCount >= 40000) {

            /*const textDecoder = new TextDecoder('utf-8'); // ใช้ 'utf-8', 'iso-8859-1', 'windows-1252' ขึ้นอยู่กับข้อมูล
            const text = textDecoder.decode(data);
            console.log('Received binary data as text:', text);*/
            const client = new SpeechClient();
            const audioContent = Buffer.from(data, 'base64');
            const request = {
                config: {
                  encoding: 'LINEAR16', // หรือประเภทที่ตรงกับข้อมูลของคุณ
                  sampleRateHertz: 16000, // อัตราการสุ่มข้อมูล
                  languageCode: 'en-US', // ภาษา
                },
                interimResults: false, // ใช้ผลลัพธ์ชั่วคราวหรือไม่
                 audio: { content: audioContent },
            };
            const recognizeStream = client.streamingRecognize(request);
            recognizeStream.on('data', (data) => {
                const results = data.results || [];
                for (const result of results) {
                  const transcript = result.alternatives[0].transcript;
                  console.log(`Transcription: ${transcript}`);
                }
            });

            this.state = 'Complete';
            this.emitter.emit('final-transcript', {
                text: 'I would like to check my account balance.',
                confidence: 1.0
            });
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