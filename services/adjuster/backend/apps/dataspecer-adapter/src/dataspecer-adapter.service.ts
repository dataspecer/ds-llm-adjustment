import { Injectable } from '@nestjs/common';

@Injectable()
export class DataspecerAdapterService {
  getHello(): string {
    return 'Hello World!';
  }
}
