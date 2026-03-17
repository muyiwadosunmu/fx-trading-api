import { HttpStatus } from '@nestjs/common';

type IStatus = 'success' | 'failure';

export interface IAPIResponse<T> {
  statusCode: HttpStatus;
  message: string;
  status: IStatus;
  data: T;
}
class APIResponse {
  statusCode: HttpStatus;
  message: string;
  data: any;
  status: IStatus;

  constructor(
    data: any,
    message = '',
    statusCode = 200,
    status: IStatus = 'success',
  ) {
    this.statusCode = statusCode;
    this.message = message;
    this.status = status;
    this.data = data;
  }
}
const APIRes = (
  data: any,
  message = '',
  statusCode: HttpStatus = 200,
  status: IStatus = 'success',
) => {
  return {
    statusCode,
    message,
    status,
    data,
  };
};

export { APIResponse as default, APIRes, APIRes as ApiResponseFormat };
