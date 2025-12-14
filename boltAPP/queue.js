/* The objective of this queue is to send packets in turns to avoid GATT error */

class Queue{
	constructor(writeFunction){
		this.running = false;
		this.tasks = [];
		this.write = writeFunction || (typeof bolt !== 'undefined' ? bolt.write : null);
	}

	runCommand(data){
		this.running = true;
		const writeFn = this.write || (typeof bolt !== 'undefined' ? bolt.write : null);
		if (!writeFn) {
			console.error("Queue: No write function available");
			this.running = false;
			return;
		}
		writeFn(data, _ => {
			this.running = false;
			if (this.tasks.length > 0)
			{
				this.runCommand(this.tasks.shift());
			}
		})
	}

	enqueueCommand(data){
		this.tasks.push(data);
	}

	queue (data){
		!this.running ? this.runCommand(data) : this.enqueueCommand(data);
	}
}
