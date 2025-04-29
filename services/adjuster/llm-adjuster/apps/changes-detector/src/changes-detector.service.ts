import { Injectable } from '@nestjs/common';

@Injectable()
export class ChangesDetectorService {
  getHello(): string {
    return 'Hello World!';
  }
}
