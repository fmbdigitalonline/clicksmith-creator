type SaveOperation = () => Promise<void>;

class SaveQueue {
  private queue: SaveOperation[] = [];
  private isProcessing = false;

  async add(operation: SaveOperation) {
    this.queue.push(operation);
    if (!this.isProcessing) {
      await this.process();
    }
  }

  private async process() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const operation = this.queue.shift();

    try {
      if (operation) {
        await operation();
      }
    } finally {
      await this.process();
    }
  }
}

export const saveQueue = new SaveQueue();