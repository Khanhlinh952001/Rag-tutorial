import { Controller, Get } from "@nestjs/common";
import { QueuesService } from "./queues.service";

@Controller("queues")
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get("stats")
  stats() {
    return this.queuesService.stats();
  }
}
