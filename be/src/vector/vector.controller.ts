import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { VectorService } from './vector.service';
import { CreateVectorDto } from './dto/create-vector.dto';
import { UpdateVectorDto } from './dto/update-vector.dto';

@Controller('vector')
export class VectorController {
  constructor(private readonly vectorService: VectorService) {}

  @Post()
  create(@Body() createVectorDto: CreateVectorDto) {
    return this.vectorService.create(createVectorDto);
  }

  @Get()
  findAll() {
    return this.vectorService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vectorService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVectorDto: UpdateVectorDto) {
    return this.vectorService.update(+id, updateVectorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vectorService.remove(+id);
  }
}
