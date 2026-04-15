import time
from mpi4py import MPI
import asyncio

from mpi.worker import async_worker_engine

def master_loop(comm):
    print("Master node initialized. Waiting for signals...")
    while True:
        try:
            comm.barrier()
            signals = comm.gather(None, root=0)
            
            print("\n" + "="*50)
            print(" MASTER RECEIVED SIGNALS:")
            for sig in signals:
                if sig is not None:
                    print(f" -> Pair: {sig.pair} | Beta: {sig.beta:.4f} | Z-Score: {sig.z}")
            print("="*50 + "\n")
        except Exception as e:
            print(f"Master loop error: {e}")
            break

if __name__ == "__main__":

	comm = MPI.COMM_WORLD

	rank = comm.Get_rank()

	if rank == 0:
		master_loop(comm)
	else:
		asyncio.run(async_worker_engine(comm, rank))