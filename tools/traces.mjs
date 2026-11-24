// Stable roles keep the same address throughout a replay, including when an executor is replaced.
const roles = {
  cli:['Submit client','Submit host','process','yarn-client'],
  rm:['ResourceManager','YARN','service','resource-manager'],
  nm:['NodeManager','Worker node','service','node-manager'],
  am:['ApplicationMaster','AM container','process','application-master'],
  alloc:['YarnAllocator','Inside the AM','scheduler','yarn-allocator'],
  py:['Python driver','Driver process','python','python-driver'],
  driver:['Spark driver','Driver JVM','scheduler','spark-driver'],
  backend:['Driver backend','Driver JVM','service','driver-scheduler-backend'],
  exe:['Executor JVM','Worker node','worker','executor'],
  ex2:['New executor','Worker node','worker','executor'],
  worker:['Python worker','Executor container','python','python-worker'],
  dag:['DAGScheduler','Driver JVM','scheduler','dag-scheduler'],
  tsm:['TaskSetManager','Driver JVM','scheduler','task-set-manager'],
  task:['Task attempt','Executor thread','worker','task-attempt'],
  twin:['Sibling attempt','Different executor','worker','task-attempt'],
  result:['TaskResultGetter','Driver JVM','scheduler','task-result-getter'],
  hb:['HeartbeatReceiver','Driver JVM','service','heartbeat-receiver'],
  eam:['Allocation manager','Driver JVM','scheduler','executor-allocation-manager'],
  mon:['ExecutorMonitor','Driver JVM','service','executor-monitor'],
  bm:['BlockManager','Executor JVM','disk','block-manager'],
  rdd:['RDD lineage','Partition recipe','plan','rdd-cache'],
  fs:['Filesystem','Shared storage','disk','hdfs-datanode'],
  sql:['SQL planner','Driver JVM','plan','sql-planner'],
  aqe:['Adaptive planner','Driver JVM','plan','adaptive-query-execution'],
  stats:['Map statistics','Shuffle stage','disk','map-output-tracker-master'],
  map:['Map executor','Producer node','worker','shuffle-writer'],
  reader:['Reduce executor','Consumer node','worker','shuffle-reader'],
  old:['Old block server','Producer node A','disk','shuffle-block-resolver'],
  fresh:['New map output','Producer node C','disk','shuffle-writer'],
  tracker:['MapOutputTracker','Driver metadata','plan','map-output-tracker-master'],
  exchange:['Broadcast exchange','Driver JVM','plan','broadcast-exchange'],
  br:['Broadcast handle','Driver JVM','plan','broadcast-manager'],
  hash:['Hash relation','Executor memory','disk','broadcast-hash-join'],
  writer:['File writer','Executor task','worker','file-format-writer'],
  commit:['Commit protocol','Driver / task roles','service','file-commit-protocol'],
  am2:['AM attempt 2','New container','process','application-master'],
  user:['Caller','Submitter','process','spark-submit'],
  scan:['File scan','Executor JVM','worker','executor'],
  index:['File index','Driver metadata','plan','sql-planner'],
  sort:['ExternalSorter','Executor task','worker','task-attempt'],
  disk:['Local disk','Worker node','disk','block-manager'],
  mem:['Execution memory','Executor JVM','disk','executor'],
  c1:['Task attempt 0','Executor A','worker','task-attempt'],
  c2:['Task attempt 1','Executor B','worker','task-attempt'],
  group:['Job groups','Driver properties','plan','dag-scheduler'],
  pys:['Closure serializer','Python driver','python','python-driver'],
  jc:['SparkContext','Driver only','service','spark-context'],
  part:['Partition stream','Executor input','disk','task-attempt'],
  batch:['Input partitions','Shuffle map side','worker','shuffle-writer'],
  win:['Window task','Executor thread','worker','task-attempt'],
  ck:['Checkpoint RDD','Reliable storage','disk','rdd-cache'],
  file:['Data file','Input storage','disk','hdfs-datanode'],
  fixed:['Normalized batch','New output path','disk','file-format-writer'],
};

const traces = {};
function scene(id, question, yes, no, rows) {
  const nodes = new Map();
  const events = rows.trim().split('\n').map(line => {
    const [edge, label, state, detail] = line.trim().split('|').map(s => s.trim());
    const [from,to,kind] = edge.split(' ');
    if (!roles[from] || !roles[to] || !['control','data','decision','blocked','failure','recovery'].includes(kind)
        || !label || !state || !detail) throw Error(`Invalid event in case ${id}: ${line}`);
    for (const key of [from,to]) {
      const [name,host,icon,reference] = roles[key];
      nodes.set(key,{key,name,host,icon,reference});
    }
    return {from,to,kind,label,state,detail};
  });
  traces[id]={nodes:[...nodes.values()],events,decision:{question,yes,no}};
}

scene('01','Does the whole container fit the RM maximum?','Submit the AM specification','Reject before requesting a container',`
cli rm control | getNewApplication | Capability requested | The client asks for a new application; no driver or executor has started.
rm cli data | Maximum capability | Application ID assigned | An ID and maximum resource capability are a reply, not an allocation.
cli cli decision | Calculate container size | Heap + overhead counted | Add executor heap, overhead, configured off-heap and explicit Python memory; check the AM separately.
cli cli failure | Limit exceeded | Submission stopped | An 8 GiB heap plus overhead cannot fit an 8 GiB limit. No AM launch request is sent.
cli cli recovery | Re-size the request | Validation passes | On a new submission a smaller total passes this gate. Queue capacity is a separate decision.`);
scene('02','Did SparkContext become available before the deadline?','Register the AM and allocate executors','Fail the application attempt',`
am py control | Launch user script | Python started | The driver thread enters PythonRunner and launches the separate interpreter.
py py blocked | Startup dependency | Context not created | The script is blocked before starting SparkContext; a Python process alone is not a scheduler.
am am decision | Await context promise | Waiting for endpoint | The AM needs the context and its driver endpoint before it initializes the allocator.
am am failure | waitTime expires | Attempt failed | No executor request was made. Look at the earlier Python startup output, not executor logs.`);
scene('03','Can the executor reach the advertised driver RPC address?','Bootstrap, register, then offer slots','Fix the advertised address before retrying',`
am nm control | Start executor container | Launch requested | The grant identifies a NodeManager, not an executor ready for tasks.
nm exe control | Launch with driver URL | JVM running | The NodeManager starts the executor using the address in the launch command.
exe driver blocked | RetrieveSparkAppConfig | Driver unreachable | If localhost was advertised in client mode, it points back to the worker, not the submit host.
am exe recovery | Replacement launch | Same bad URL | Replacing the JVM does not change the address it was given.
exe driver recovery | RegisterExecutor | Registered on rerun | After fixing reachability, the executor registers and separately signals readiness with LaunchedExecutor.`);
scene('04','Was the disconnect unexpected and configured as failure?','AM reports FAILED','Inspect exit code and verify sink publication',`
driver am control | Maintain driver connection | Remote driver connected | In client mode this driver lives outside the AM container.
driver am blocked | Driver connection lost | Link unavailable | The AM observes a disconnect; it cannot infer that the last write committed.
am am decision | Inspect disconnect policy | Exit reason classified | An unexpected disconnect can be marked failed by spark.yarn.am.clientModeTreatDisconnectAsFailed.
am rm control | Final status | Attempt finishes | Under the default policy and without a nonzero exit code the reported status can instead be success.
rm nm control | Clean containers | Resources reclaimed | YARN can reclaim these containers but cannot reconstruct the external Python driver.`);
scene('05','Is runnable backlog still present when the timer fires?','Raise the executor target within bounds','Keep the existing target',`
tsm eam control | Pending tasks | Backlog timer started | Busy executor slots leave runnable partitions waiting.
eam eam decision | Recheck demand | Higher target | Sustained backlog, task capacity and configured limits determine the requested total.
eam alloc control | Request executors | Target received | The driver backend relays the desired capacity; there are no new slots yet.
alloc rm control | allocate | Requests pending | YARN may grant fewer containers than requested.
rm alloc data | Container grant | Placement known | The AM now knows which NodeManager may launch an executor.
alloc nm control | Start container | Launch requested | The allocation is turned into a process launch.
exe backend control | LaunchedExecutor | Slots ready | After bootstrap and registration, the backend can offer slots to tasks.`);
scene('06','Is the idle executor eligible and above the protected minimum?','Request removal or decommissioning','Keep it for cached or active shuffle state',`
exe mon control | Tasks finish | Idle clock starts | Finishing the last task does not itself remove the executor.
mon mon decision | Inspect retained blocks | Cache protected | Cached blocks may use a longer timeout; tracked active shuffle data can prevent removal.
mon eam control | Eligible idle executor | Candidate reported | After protection ends, the scan supplies candidates, not an unconditional kill.
eam backend control | Remove if above bounds | Removal requested | The allocation manager preserves its minimum and target, then requests removal or decommissioning.
backend alloc control | Release executor | Capacity adjusted | Removing this executor does not stop the driver or finish the application.`);
scene('07','Is a usable cached copy available for this partition?','Read it locally or remotely','Compute the partition and try to cache it',`
task bm control | Lookup partition 12 | Block requested | A persisted RDD asks the BlockManager for one partition, not the whole dataset.
bm bm decision | Search available copies | Cache miss | The only usable copy was evicted in this illustration.
bm rdd control | Invoke compute path | Lineage evaluated | This may read a checkpoint or recompute upstream dependencies.
rdd bm data | Computed partition | Store attempted | The chosen storage level governs whether the new copy can be retained.
bm task data | Return iterator | Task continues | Even if the block cannot be retained, the current task can consume the records.`);
scene('08','Can the predicate be expressed as a native SQL expression?','Keep evaluation in the JVM','Plan an executor-side Python evaluation',`
py sql control | Build filtered plan | Predicate analyzed | Similar Python source can describe a JVM expression or an opaque Python UDF.
sql exe control | BatchEvalPython | Python path selected | This trace takes the regular scalar non-Arrow branch, not the native predicate.
exe worker data | Pickled input batch | Evaluate function | Only the required inputs travel across the local worker boundary.
worker exe data | Predicate results | Rows associated | The JVM associates results with the corresponding inputs and continues filtering.
sql exe recovery | Native expression variant | No worker boundary | In the comparison run, a built-in predicate with matching null semantics needs no Python worker.`);
scene('09','Is the build side eligible and small enough to broadcast?','Broadcast a hashed build relation','Inspect an alternative physical join plan',`
sql exchange control | Build-side exchange | Build chosen | Equi-join keys and the physical join type determine which side can build.
exchange exchange decision | Materialize relation | Relation sized | The driver must materialize and distribute the relation; small row count is not a byte bound.
exchange br control | Broadcast relation | Pieces available | The broadcast is identified by a handle passed with the plan.
br hash data | Obtain broadcast pieces | Hash relation ready | Executors obtain the broadcast value; this is not a shuffle of the large streamed side.
reader hash data | Probe build keys | Matching rows | Streamed-side tasks match local input rows against the read-only build relation.`);
scene('10','Is a skewed reducer partition eligible and splittable?','Split reads and pair the matching side','Keep original shuffle reads',`
map stats data | Map output sizes | Statistics materialized | AQE needs actual shuffle sizes, not just the optimizer estimate.
stats aqe data | Bytes by partition | Outlier detected | The partition must exceed both the absolute threshold and the median-based factor.
aqe aqe decision | Build split specs | Pairings selected | Split ranges must be possible on the eligible side; matching-side data may be replicated.
aqe reader control | Schedule split reads | Smaller tasks | If distribution requirements are met, tasks read new pairings instead of one large partition.
map reader data | Matching shuffle data | Join proceeds | The tradeoff is more parallel work and possibly repeated reads; this is not speculative duplication.`);
scene('11','Is the failed block still available from its serving host?','Retry the read if transport policy permits','Invalidate the output and recompute its producer',`
reader tracker control | Look up map outputs | Addresses requested | The reducer needs one reduce slice from each map output. It asks for metadata, not the rows.
tracker reader data | MapStatus: host A | Old location known | Cached metadata identifies the producer or external shuffle service and the expected block size.
reader old blocked | Fetch shuffle block | Block unavailable | The read cannot obtain the bytes from host A, even after eligible transport retries. The cross marks a failed transfer.
reader dag failure | FetchFailed | Consumer attempt failed | The executor reports the producer address and shuffle/map/reduce identifiers. The driver checks the stage attempt.
dag tracker control | Invalidate location | Old output removed | The scheduler marks missing map output unavailable; a retry against the same stale address would not fix it.
dag fresh recovery | Resubmit map task | Producer rebuilding | Within its stage retry budget Spark schedules missing producer work on a suitable executor, here node C.
fresh tracker data | New MapStatus | Location changed to C | The replacement map task publishes where its output can be fetched. Data bytes stay off the driver.
tracker reader data | Refresh locations | Consumer retried | The retried reduce attempt can resolve a valid serving address.
fresh reader recovery | Deliver block bytes | Reduce can finish | The bytes move from the serving node to the consumer, not through the scheduler or YARN.`);
scene('12','Does the same partition fail with the same exception?','Inspect the data or function','Compare host-specific failures and attempt IDs',`
tsm worker control | Run Python partition | First attempt | An executor-side Python worker runs the user mapping function.
worker exe failure | Python exception | Task failed | The same malformed record causes a deterministic exception.
exe tsm failure | Task end reason | Failure counted | TaskSetManager decides if this reason counts against the partition's budget.
tsm worker recovery | Retry partition | Same input | A different executor still sees the same code and data.
tsm dag failure | Failure limit reached | Job aborted | Exhausting this task's counted failures aborts its task set; catching the action exception is a driver decision.`);
scene('13','Does the running attempt qualify for speculation?','Start one eligible sibling attempt','Keep the original attempt running alone',`
tsm c1 control | Launch task | Attempt running | One logical partition initially has a single attempt.
tsm tsm decision | Compare peer runtimes | Speculatable | A long runtime alone is not sufficient; thresholds and placement rules apply.
tsm c2 control | Launch speculative copy | Two attempts live | No failure or stage restart is required to run this sibling.
c2 tsm data | First accepted success | Result accepted | In this example attempt 1 wins. Attempt 0 could win instead.
tsm c1 control | Kill remaining attempt | Sibling cancelled | Spark accepts one logical result, but external side effects may already have happened twice.`);
scene('14','Has last-seen age exceeded the effective timeout?','Remove executor and request replacement','Keep waiting for a heartbeat',`
exe hb control | Heartbeat | Last seen updated | The receiver tracks liveness separately from the NM's YARN heartbeat.
exe hb blocked | Next heartbeat absent | No fresh timestamp | A pause or broken path can look the same to the driver; one late message is not proof of host loss.
hb hb decision | ExpireDeadHosts | Deadline exceeded | A periodic check compares elapsed time with the effective executor timeout.
hb backend failure | RemoveExecutor | Slots withdrawn | The driver removes the lost executor and requests replacement instead of waiting indefinitely for disconnect.
backend tsm recovery | executorLost | Tasks reconsidered | Eligible interrupted work is scheduled again; replacement slots still require allocation and registration.`);
scene('15','Did YARN classify the container as PREEMPTED?','Reschedule without charging an app-caused task failure','Check the actual container exit reason',`
rm nm control | Reclaim container | Preemption ordered | The scheduler reclaims resources for the queue, independently of Spark task logic.
nm exe failure | Container stopped | Executor lost | Running task attempts and executor-local state may disappear.
rm alloc data | PREEMPTED | Loss classified | The AM sees a completed-container report during allocation and marks the loss not caused by the application.
alloc tsm control | Executor loss reason | Task budget preserved | The driver backend relays the reason; ordinary task attempts lost this way need not count against the failure limit.
tsm task recovery | Reoffer partition | Work retried | Retrying still consumes time and needs a surviving or replacement executor.`);
scene('16','Do container diagnostics say physical memory exceeded?','Measure total RSS and partition working set','Investigate the reported exit reason instead',`
nm nm decision | Measure container usage | RSS over limit | The NodeManager checks container memory usage. JVM, Python and native allocations all contribute; Spark did not send a heap metric to the RM to trigger this kill.
nm exe failure | Enforced memory limit | Container killed | This does not require a Java OutOfMemoryError.
rm alloc data | KILLED_EXCEEDED_PMEM | Loss classified | Container diagnostics reach the AM via the ResourceManager.
alloc tsm failure | App-caused loss | Attempt may count | This reason differs from preemption. Repeating the same working set can kill another container.
tsm task recovery | Retry after sizing | Verify peak usage | Use comparable input to verify partition sizing or overhead changes, not just a new container ID.`);
scene('17','Does the cumulative serialized result exceed the positive limit?','Abort the task set','Continue collecting remaining results',`
py driver control | collect | Result stage running | Every partition is asked for records to return to the driver.
task result data | Direct result or reference | Size accounted | Large permitted results may use a block reference rather than carrying all bytes in the status message.
result tsm control | Add serialized bytes | Total increasing | The guard uses the cumulative serialized size for the result task set, not just the biggest partition.
tsm driver failure | Limit exceeded | Task set aborted | Changing transport or splitting the same total bytes more finely does not remove this limit.
driver py failure | Action raises | No complete list | Prefer distributed output or a bounded summary when the full collection is unnecessary.`);
scene('18','Did the driver successfully complete commitJob?','Publish the committed dataset','Attempt abort and inspect partial output',`
writer fs data | Write task files | Staged output | Each executor writes records through the sink's task writer.
writer commit control | Commit task attempt | Task accepted | Individual attempts can finish successfully even when publication later fails.
commit driver data | Task commit messages | All tasks green | The driver gathers messages for the Hadoop-backed V1 write.
driver commit control | commitJob | Finalizing | The commit protocol still has to publish the whole job.
commit fs blocked | Finalize output | Filesystem error | This illustrative failure occurs during job commit, not during task execution.
driver commit recovery | abortJob | Cleanup attempted | Abort is best effort; inspect the destination and committer semantics before retrying.`);
scene('19','Does the active stage belong only to the cancelled group?','Cancel its running attempts','Preserve work needed by another job',`
py group control | cancelJobGroup | Group ID supplied | The cancellation is scoped to jobs submitted under the group property.
group dag control | Match active jobs | Jobs identified | The scheduler checks ownership of running stages.
dag dag decision | Check shared stages | Shared work preserved | Work still needed by another active job is not independently cancelled here.
dag tsm control | Kill eligible attempts | Group cancelled | Only the applicable attempts are killed; the SparkContext stays alive.
dag py failure | Cancellation result | Caller notified | An unrelated job group can still complete successfully.`);
scene('20','Is the lost AM attempt eligible for another YARN attempt?','Launch a fresh AM and rerun the script','End the application with failure',`
am rm blocked | Attempt stops reporting | AM unavailable | In cluster mode the lost AM container also held the JVM-side driver.
rm rm decision | Check retry policy | Attempt eligible | A YARN application-attempt budget, not spark.task.maxFailures, controls this branch.
rm nm recovery | Start next AM container | New placement | YARN keeps the application ID but assigns a new attempt ID.
nm am2 control | Launch AM JVM | Fresh driver JVM | No Python stack, DAG scheduler state, or cached driver variables are transferred.
am2 py recovery | Enter script again | New Python process | The new driver starts at the entry point. Previous successful external writes may still exist.
am2 rm control | Register new attempt | New executor requests | With a new context, the application negotiates capacity again. Check attempt IDs in diagnostics.`);

scene('21','Did submission specify reusable Spark JARs or an archive?','Reference the configured distribution','Build and stage a ZIP for this submission',`
cli cli decision | Resolve Spark libraries | No archive configured | The client first checks spark.yarn.archive and spark.yarn.jars.
cli cli control | Zip readable JARs | Local ZIP built | Without either setting, the submitting process collects the JARs under its Spark installation.
cli fs data | Upload archive | Shared resource ready | The upload is application staging traffic. This time is not executor startup latency.
cli rm control | Submit LocalResource | Launch spec registered | The launch context names __spark_libs__ as an archive to localize; the RM receives metadata.
fs nm data | Localize on cache miss | Classes available | The selected NM unpacks the archive before JVM launch. A compatible prebuilt archive avoids rebuilding it each submission.`);
scene('22','Did the client observe terminal application success?','Check the sink publication condition','Continue monitoring by application ID',`
user cli control | Start spark-submit | Monitoring disabled | This example uses cluster mode without a connected launcher and without waiting for completion.
cli rm control | Submit application | Accepted for scheduling | Acceptance does not imply that the user program has run.
rm cli data | Initial app report | Not terminal | The client checks for already failed or killed state; an early report can still say ACCEPTED.
cli user control | Return to shell | Submitter exited | A downstream command starting now could read stale or nonexistent output.
am rm control | Later final status | Terminal result | Monitor this application ID and verify sink publication before consuming the data.`);
scene('23','Can the executor-side Python interpreter import the module?','Run the partition function','Distribute the missing worker dependency',`
py py decision | Driver import | Module available locally | A helper beside the main script can import even when it is absent on every executor.
exe worker control | Invoke partition function | Worker import attempted | A task runs the function in the executor-side interpreter.
worker exe failure | ModuleNotFoundError | Task failed | The worker is missing the package on its own import path.
py fs recovery | Register versioned ZIP | Dependency published | Use --py-files at submission or addPyFile before the action. Put the importable package at the archive root.
exe worker recovery | Set worker include path | Import succeeds | On a new attempt with the localized dependency, verify the module version from the worker, not the driver.`);
scene('24','Do worker and driver Python major.minor versions match?','Deserialize and run the Python function','Reject the command before user code runs',`
py exe control | Send Python command | Driver version supplied | Initialization carries the Python version that prepared the command.
exe worker control | Start interpreter | Worker version known | Executor configuration chooses the executable on that machine.
worker worker decision | Compare major.minor | 3.11 versus 3.12 | The worker checks compatibility before it deserializes the user function.
worker exe failure | PYTHON_VERSION_MISMATCH | Function not entered | A JVM-only SQL action does not exercise this handshake.
exe worker recovery | Use aligned environment | Command accepted | Rerun the Python task with matching minors and check the version inside an actual worker.`);
scene('25','Does the closure capture the driver-only SparkContext?','Reject it during serialization','Ship serializable values with the task',`
py pys control | Prepare Python command | Closure traversed | The lambda captures sc even if it only wants sc.applicationId.
pys jc control | Pickle captured context | Pickling guard invoked | CloudPickle encounters the context while walking the function's dependencies.
jc pys failure | CONTEXT_ONLY_VALID_ON_DRIVER | No task launched | The driver-side guard rejects serialization before any worker could run this code.
py pys recovery | Capture plain app ID | Command serialized | Read the ID on the driver; the replacement lambda now captures just a string.
exe worker control | Run corrected closure | Value received | No SparkContext is transferred to the worker.`);
scene('26','Can one materialized partition fit on the driver?','Stream it to the Python iterator','Reduce partition size or keep work distributed',`
py driver control | Request next partition | Iterator demand | Python requests data from a local socket; the full result is not eagerly collected.
driver task control | Submit partition job | One partition selected | A job computes the selected partition. Optional prefetch can submit the next one early.
task driver data | Partition array | Entire split materialized | One abnormally large partition can still exceed size or memory limits.
driver py data | Stream records locally | Partition consumed | Processing incrementally avoids retaining all previous rows. Calling list on the iterator defeats that benefit.
py driver control | Continue or stop | Demand controls work | Without prefetch, the next partition is requested only when needed.`);
scene('27','Have enough qualifying records been found?','Return the requested sample','Scan another batch of partitions',`
py driver control | take(3) | First partition selected | The Python RDD take loop initially probes one partition.
driver task control | Run bounded scan | At most three requested | A selected task need not emit all matching records.
task py data | Empty result batch | More input needed | Early partitions may contain none of the rare values.
py driver control | Widen partition range | Another job submitted | With no hits the driver grows the next batch; otherwise it estimates how many more partitions are needed.
task py data | Three matching records | Sample complete | Multiple successful jobs at one take call site need not indicate a retry.`);
scene('28','Does the window have a valid partition key?','Cluster by key and rank within groups','Gather all rows for global window semantics',`
py sql control | Global row_number | Unkeyed window | The requested ordering spans the dataset, not each business group.
sql sql decision | Require AllTuples | SinglePartition needed | Multiple input partitions cannot each calculate an independent global rank.
batch win data | Exchange and sort | Rows gathered | Values arrive in one partition and are ordered for the window.
win win control | Evaluate window | One task ranks rows | Extra idle workers cannot split this operator while preserving this physical requirement.
py sql recovery | Compare keyed requirement | Different semantics | Only switch to partitionBy(customer) if ranks really should restart per customer.`);
scene('29','Is a mergeable summary sufficient for each key?','Send partial aggregates','Keep the original values for grouping',`
part worker data | Read repeated keys | Per-partition input | A region occurs many times in each of several map partitions.
worker worker decision | Select combiner | List versus partial sum | A PySpark groupByKey list still retains amounts. An associative sum can collapse them locally.
worker map data | Emit map-side combiner | Shuffle payload prepared | The comparison is bytes of lists versus bytes of partial sums, not just number of key labels.
map reader data | Shuffle by region | Values colocated | All partials for a particular final key still meet in one reducer partition.
reader py data | Return per-key totals | Compare same answer | Compare output totals and measured shuffle bytes before adopting the alternative.`);
scene('30','Does coalescing introduce a shuffle here?','Parallelize upstream work before the final partition','One narrow output partition walks its parents',`
py rdd control | coalesce(1) | Narrow dependency | No shuffle was requested in this branch.
driver task control | Launch one output task | One active slot | With one output partition, the scheduler cannot offer the same partition as useful independent work.
rdd task data | Iterate parent partitions | Upstream work concentrated | Uncached parents in a narrow chain can be evaluated by this same task.
task writer data | Save output | One writer partition | More YARN containers alone cannot increase this final parallelism.
py rdd recovery | Compare repartition(1) | Shuffle introduced | Map-side work can run concurrently, but the final write still has one output partition.`);
scene('31','Has the reliable checkpoint successfully materialized?','Switch to the checkpoint dependency','Keep the original lineage',`
py rdd control | checkpoint() | RDD marked | Setting a reliable directory and marking the RDD does not write partitions yet.
py driver control | Trigger action | Computation requested | The action computes the RDD; the subsequent checkpoint job needs its data.
task fs data | Write partition files | Checkpoint building | Uncached upstream data can be recomputed during this materialization.
fs ck data | Completed checkpoint | Reliable input available | Only after successful completion does the checkpoint become a usable parent.
ck rdd recovery | Replace old dependency | Lineage shortened | A new action can read checkpointed data; this is not a checkpoint of Python variables or a running driver.`);
scene('32','Can the task grow its execution-memory allocation?','Keep the collection in memory','Spill an intermediate run and continue',`
sort mem control | Request more memory | Threshold reached | This JVM sorter monitors estimated collection size; forced-spill thresholds are another route.
mem sort decision | Partial grant | Growth insufficient | A denied or insufficient grant can make a spill necessary without killing the container.
sort disk data | Write intermediate run | Run spilled | Serialized bytes on disk need not equal the estimated bytes freed from memory.
sort mem recovery | Release allocation | Task continues | The sorter can make progress on its next in-memory collection.
disk sort data | Merge spilled runs | Output produced | A successful task can report both memoryBytesSpilled and diskBytesSpilled.`);
scene('33','Is the driver-side broadcast handle still valid?','Fetch missing pieces on demand','Create a new broadcast before another action',`
py br control | unpersist | Executor eviction requested | Unpersist drops persisted executor state but does not invalidate the driver handle.
br bm data | Re-fetch broadcast pieces | Value usable again | A later executor task can use the broadcast after fetching it again.
py br control | destroy | Handle invalidated | Destroy requests deletion of driver and executor broadcast state.
pys br failure | Serialize destroyed handle | Reuse rejected | The old handle is no longer valid for a newly submitted closure.
py br recovery | Broadcast new lookup | New broadcast ID | Construct a new broadcast and verify another action returns the expected values.`);
scene('34','Can small compatible reducer ranges be combined?','Rewrite the shuffle reader specifications','Keep the existing partition reads',`
map stats data | Publish map sizes | Shuffle materialized | Two hundred planned buckets can contain very little data after filtering.
stats aqe data | Bytes per partition | Group candidates | AQE evaluates compatible stages, advisory size and parallelism constraints.
aqe aqe decision | Coalesce partition specs | Fewer read groups | It changes read ranges rather than rerunning map tasks to write new buckets.
aqe reader control | Launch grouped reads | Fewer reader tasks | One reader can consume several original reducer ranges.
map reader data | Read assigned ranges | Same grouped result | Verify the final adaptive plan and output; this need not remove YARN executors.`);
scene('35','Can this predicate prune the partition key?','List only matching catalog partitions','Keep directory candidates; evaluate data filters separately',`
py sql control | Filter sale_date | Predicate analyzed | This example uses a V1 catalog table partitioned by sale_date.
sql index control | Filter partition metadata | Date predicate eligible | A predicate only on amount cannot identify date directories in this rule.
index sql data | Pruned file index | Smaller candidate set | The optimizer replaces the file index and updates its size estimate.
sql scan control | Plan matching splits | Fewer input files | Excluded date directories do not become executor scan work.
file scan data | Read selected files | Scan metrics available | Check PartitionFilters and files read; Parquet pushed filters are a separate mechanism.`);
scene('36','Does the requested Spark type match a supported physical conversion?','Decode the selected column','Identify the offending file and normalize the batch',`
driver scan control | Read schema: amount INT | Integer requested | Materialize the column: a row count alone may prune it and hide the mismatch.
file scan data | File schema: BINARY UTF8 | String physically stored | The file exists and its footer is readable; it was produced by a different writer schema.
scan scan decision | Choose column updater | Unsupported conversion | The vectorized reader cannot supply the requested integer directly from this physical string column.
scan driver failure | Column type mismatch | Path and column reported | Retrying the identical split on another node does not change its bytes.
file writer recovery | Read native schema | Values validated | In a separate repair job, read this batch as strings, validate and explicitly cast compatible values.
writer fixed data | Write corrected Parquet | New path committed | Do not overwrite the only input during diagnosis.
fixed scan recovery | Read back as INT | Type and totals verified | Verify the number of rows and sum of amount, not just the ability to list the directory.`);
scene('37','Is this a missing file and is skipping acceptable?','Skip only if partial data is an explicit requirement','Restore the snapshot and fail incomplete reads',`
index driver data | List data files | Split planned | The driver can successfully list a path that disappears before execution.
driver scan control | Open planned split | Task started | The executor attempts to open its assigned data file.
scan file blocked | Open missing file | File unavailable | Another process removed or moved it after listing.
scan scan decision | Check ignoreMissingFiles | Failure or skip | ignoreCorruptFiles alone is not an instruction to ignore a missing path.
scan driver failure | Report missing path | Action fails on strict path | On the permissive branch a warning replaces the exception, but the missing rows are absent.
file scan recovery | Read restored snapshot | Full input verified | A restored immutable fixture should yield the expected count without ignoring files.`);
scene('38','Does the output already exist with save mode Ignore?','Skip insertion without validating contents','Apply the selected write mode',`
py driver control | Save to existing path | Mode checked | The second batch targets the same V1 output directory as the first one.
driver fs control | exists(path) | Existence checked | This check does not compare rows, schema or business date.
fs driver data | Path exists | Insertion decision | ErrorIfExists would fail here; Ignore selects the no-insertion branch.
driver py control | Return from save | No new output tasks | Successful return is not evidence that the new two-row batch was published.
fs py data | Read back fixture | Original row remains | Choose an explicit publication policy if the new data must replace or augment the old.`);
scene('39','Is this an eligible dynamic partition overwrite?','Replace only the partition paths actually written','Inspect static overwrite scope before running',`
driver commit control | Configure dynamic overwrite | Scoped write planned | This is a Hadoop-backed V1 partitioned dataset with a supporting committer.
writer fs data | Stage Monday and Wednesday | Two dates written | No task writes Tuesday, so it is not in the touched set.
writer commit data | Task commit messages | Changed paths known | The driver-side protocol gathers the paths actually produced by successful tasks.
commit fs control | Replace touched directories | Two partitions replaced | Existing Monday contents are replaced, not row-merged. Wednesday is added.
fs driver data | Read all date partitions | Tuesday retained | Compare before/after keys by date rather than treating a green job as a full-root refresh.`);
scene('40','Has this writer already filled its current file?','Close it and open the next data file','Append the next record to the current file',`
driver writer control | maxRecordsPerFile = 1000 | One task configured | The positive limit comes from the write option in the 2,500-row fixture.
writer fs data | Write first 1,000 rows | c000 filled | The counter is local to this writer; it does not create a new Spark partition.
writer fs data | Roll and write next 1,000 | c001 filled | Before the next record, the writer closes the full file and opens a new one.
writer fs data | Write last 500 rows | c002 written | There are now three data files from the same task attempt.
writer commit control | Commit task output | Three files, one task | Compare per-file row counts and exclude marker files such as _SUCCESS.`);

// A specimen is an illustrative physical object, not another actor. Timed changes take
// effect when the associated one-based event settles, including when seeking backwards.
traces['11'].specimens=[
  {node:'old',type:'block',name:'Slice A',initial:'known',changes:{3:'missing'}},
  {node:'fresh',type:'block',name:'Slice C',initial:'pending',changes:{6:'building',7:'ready'}},
  {node:'reader',type:'block',name:'Input',initial:'pending',changes:{9:'ready'}}
];
traces['11'].events[8].payload='block';
traces['20'].specimens=[
  {node:'am',type:'attempt',name:'AM 01',initial:'ready',changes:{1:'missing'}},
  {node:'am2',type:'attempt',name:'AM 02',initial:'pending',changes:{3:'building',4:'ready'}}
];
traces['36'].specimens=[
  {node:'file',type:'file',name:'UTF8',initial:'known',changes:{}},
  {node:'fixed',type:'file',name:'INT',initial:'pending',changes:{6:'ready'}}
];
traces['36'].events[6].payload='block';

export {traces};
