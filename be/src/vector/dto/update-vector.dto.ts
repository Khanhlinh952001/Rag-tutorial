import { PartialType } from '@nestjs/mapped-types';
import { CreateVectorDto } from './create-vector.dto';

export class UpdateVectorDto extends PartialType(CreateVectorDto) {}
