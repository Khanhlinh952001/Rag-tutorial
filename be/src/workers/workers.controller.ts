import { Controller, Post, Param } from "@nestjs/common";
import { WorkersService } from "./workers.service";

@Controller("workers")
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post("process/:id")
  processDocument(@Param("id") id: string) {
    return this.workersService.processDocument(id);
  }

  @Post("process-pending")
  processPending() {
    return this.workersService.processPending();
  }
}
