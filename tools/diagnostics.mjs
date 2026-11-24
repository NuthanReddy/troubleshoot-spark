import {pathToCase} from '../docs/triage.js';

const official={
  config:'https://spark.apache.org/docs/latest/configuration.html', sql:'https://spark.apache.org/docs/latest/sql-error-conditions.html',
  tuning:'https://spark.apache.org/docs/latest/tuning.html', plan:'https://spark.apache.org/docs/latest/sql-performance-tuning.html',
  yarn:'https://spark.apache.org/docs/latest/running-on-yarn.html', ui:'https://spark.apache.org/docs/latest/web-ui.html',
  cloud:'https://spark.apache.org/docs/latest/cloud-integration.html', parquet:'https://spark.apache.org/docs/latest/sql-data-sources-parquet.html',
  python:'https://spark.apache.org/docs/latest/api/python/tutorial/sql/arrow_pandas.html'
};
const words=s=>s.trim()?s.trim().split(/\s+/):[];
const strip=s=>s.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g,'').replace(/<[^>]*>/g,' ').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/\s+/g,' ').replace(/[\s·]+$/,'').trim();
const aliases=s=>s.split(';').map(v=>v.trim()).filter(Boolean);
// Case numbers are stable guide IDs. Keep an observation that, if confirmed, really
// supports this case's remedy (the yes branch of a teaching diagram need not be the fault).
const guides=`
01|error|above the max threshold;Required executor memory|Does the complete executor or AM request exceed the RM capability?|capacity-wait case-16||
02|error|spark.yarn.am.waitTime;Timed out waiting for SparkContext|Does the AM log show a context wait while the Python script has not initialized it?|case-03 jvm-linkage||
03|error|register executor failed;Failed to connect to driver|Does the executor fail bootstrap at the advertised driver RPC address?|case-02 shuffle-network||
04|error|Driver terminated or disconnected;clientModeTreatDisconnectAsFailed|Did the external client-mode driver disappear without an orderly stop?|case-20 case-14||
05|symptom|executors not scaling;tasks are backlogged|Is the executor target rising while registered slots lag behind?|capacity-wait case-30|notenoughexecs slow-job-slow-cluster|
06|symptom|idle executor not removed;cachedExecutorIdleTimeout|Is the idle executor protected by cached blocks, a tracked shuffle, or a configured lower bound?|case-07 capacity-wait||
07|symptom|missing cached partition;RDD recomputed|Was an expected persisted block unavailable when the second action ran?|case-31 disk-full||
08|symptom|BatchEvalPython;slow Python UDF|Is a Python evaluation operator present for a predicate expressible in native SQL?|python-memory regex-cpu|udfslow slow-map|
09|symptom|BroadcastHashJoin;BroadcastExchange|Does the final plan actually build the small side and probe it from the streamed side?|broadcast-size broadcast-despite-disable|big-broadcast-join|
10|symptom|skewed join;skewed shuffle read|Does the join have a splittable skewed reducer rather than uniformly large partitions?|key-skew shuffle-width|slow-skewed-join key-skew|
11|error|FetchFailed;FetchFailedException;missing shuffle block|Is the producer output genuinely unavailable at its recorded serving address?|shuffle-meta shuffle-checksum shuffle-network|error-shuffle|
12|error|PythonException;ValueError;task failed 4 times|Do multiple attempts for the same partition raise the same user-code exception?|case-24 python-memory case-15||
13|symptom|speculative task;another attempt succeeded|Are overlapping attempts for the same task index running on different executors?|key-skew slow-host||
14|error|Executor heartbeat timed out;no recent heartbeats|Does the driver explicitly expire the executor after the last-seen timeout?|executor-heap shuffle-network node-loss||
15|error|ContainerExitStatus.PREEMPTED;container was preempted|Does YARN explicitly label this executor completion as preemption?|case-16 node-loss||
16|error|Container killed by YARN for exceeding memory limits;KILLED_EXCEEDED_PMEM;physical memory used|Do the NodeManager diagnostics show a physical container memory-limit violation?|executor-heap python-memory memory-owner|container-oom error-executor-out-of-memory|
17|error|Total size of serialized results;spark.driver.maxResultSize;maxResultSize exceeded|Does the task-set error name cumulative serialized result bytes rather than one object or task payload?|range-sample broadcast-size kryo-limit|driver-max-result-size error-driver-max-result-size best-pratice-collect|
18|error|commitJob;job commit failed|Did task commits finish before the driver-side job commit threw?|write-stage object-commit case-38|write-fails|
19|error|Job cancelled;cancelJobGroup|Did the scheduler cancel the same group ID as the failed caller?|case-20 case-12||
20|error|ApplicationMaster failed;application attempt restarted|Is there a new attempt ID under the same YARN application ID?|case-04 node-loss case-16||
21|symptom|falling back to uploading libraries under SPARK_HOME|Does the submission client rebuild and upload the Spark distribution on each run?|large-jar capacity-wait|toolargejar|
22|symptom|waitAppCompletion=false;submitted but output missing|Did the submitter exit on a nonterminal YARN application report?|case-18 case-38||
23|error|ModuleNotFoundError;No module named|Does the missing Python module import only in the driver's environment?|jvm-linkage case-24||
24|error|PYTHON_VERSION_MISMATCH;Python in worker has different version|Do worker and driver report different Python major.minor versions?|case-23 python-memory||
25|error|CONTEXT_ONLY_VALID_ON_DRIVER;SparkContext can only be used on the driver|Does serialization of the closure traverse sc or an object holding it?|task-size kryo-limit||
26|symptom|toLocalIterator;partition too large for driver|Does the iterator consume an oversized partition, or is the caller accumulating all rows?|case-17 large-row|best-pratice-collect|
27|symptom|take starts several jobs;repeated runJob|Are the first input partitions empty after the filter during take?|case-35 scan-layout||
28|symptom|Exchange SinglePartition;No Partition Defined for Window operation;AllTuples|Does an unpartitioned window require a global order?|case-30 key-skew|singlepartition|
29|symptom|groupByKey;partial aggregation;no partial aggregate|Is the code retaining all values although its desired output is a mergeable summary?|key-skew python-memory|partial_aggregates slow-reduce|
30|symptom|coalesce(1);only one active task|Is there a narrow coalesce-to-one dependency before expensive upstream work?|case-28 shuffle-width|toofew_tasks|
31|symptom|getCheckpointFile returns None;checkpoint not materialized|Was the RDD marked for checkpointing but not yet reliably materialized?|lineage case-07|toobigdag|
32|symptom|memoryBytesSpilled;diskBytesSpilled;spill to disk|Do completed tasks show significant spill with disk I/O dominating the stage?|disk-full executor-heap shuffle-width|slow-reduce|
33|error|Attempted to use Broadcast;after it was destroyed|Was the handle destroyed before a later closure captured it?|case-07 broadcast-size||
34|symptom|AQEShuffleRead coalesced;fewer reader tasks|Does the final adaptive plan coalesce eligible small shuffle partitions?|shuffle-width case-10|toomany_tasks slow-reduce|
35|symptom|PartitionFilters;partition filter not pushed down|Does the scan visit dates that an eligible partition predicate could have excluded?|scan-layout scan-volume|slow-partition_filter_pushdown slow-map|
36|error|SchemaColumnConvertNotSupportedException;FAILED_READ_FILE.PARQUET_COLUMN_DATA_TYPE_MISMATCH;Parquet column cannot be converted|Does the reported column have an unsupported physical-to-requested type conversion in the offending file?|wrong-format damaged-input|SchemaColumnConvertNotSupportedException|
37|error|FileNotFoundException;FAILED_READ_FILE.FILE_NOT_EXIST;Skipped missing file|Did a specific data file disappear between listing and opening the planned split?|wrong-format damaged-input|error-invalid-file|
38|error|PATH_ALREADY_EXISTS;output path already exists;SaveMode.Ignore|Does the destination already exist and does the selected save mode prohibit insertion?|case-18 write-stage||
39|symptom|dynamicPartitionOverwrite;old date remains after overwrite|Was Tuesday absent from the input to a dynamic partition overwrite?|case-38 write-stage||
40|symptom|maxRecordsPerFile;more files than tasks|Do the per-file row counts match the writer's rollover cap within one successful attempt?|small-files skewed-write|slow-writes-too-many-files|
`.trim().split('\n').map(row=>row.split('|'));

const extra=[];
function entry(id,kind,branch,title,signatures,sources,docs,related,cases,scope,probes){
  const checks=probes.trim().split('\n').map(row=>{
    const [question,inspect,action,verify]=row.trim().split('|');
    if(!verify)throw Error(`Incomplete troubleshooting branch: ${id}`);
    return {question,inspect,action,verify};
  });
  extra.push({id,kind,branch,title,aliases:aliases(signatures),upstream:words(sources),
    primary:words(docs).map(k=>official[k]),related:words(related),cases:words(cases),scope,checks});
}

entry('memory-owner','error','execution/memory','Out of memory: identify the process first',
 'java.lang.OutOfMemoryError;OutOfMemoryError;OOM;GC overhead limit exceeded;exit code 137;exit code 143',
 'error-memory error-executor-out-of-memory container-oom','tuning yarn ui','driver-heap executor-heap case-16 python-memory','16 17',
 'The same JVM exception can originate in the AM/driver or an executor. A process exit code is not a memory measurement.',`
Is the first heap exception in the driver JVM log?|Match the hostname, JVM role and timestamp to the first exception, before the executor disconnect messages.|Use the driver-heap investigation: distinguish collection, broadcast construction, and planning/metadata retention before sizing the heap.|The same bounded input should finish with spare driver heap and no earlier failure hidden by a later disconnect.
Does an executor stderr show a JVM heap or GC-overhead error first?|Find its executor ID in the failed stage; examine task-size distribution, concurrency, cache occupancy and GC time.|Use the executor-heap investigation. Change partition working set or concurrency according to that evidence, not driver memory.|Compare maximum partition size, executor GC time and retried tasks on the same input.
Does YARN report container physical memory exceeded without a Java heap error?|Read NM diagnostics and compare total RSS with the allocation. Exit 137 or 143 alone is inconclusive.|Use case 16; account for Python, Arrow, JNI and other native memory. If none of these observations match, obtain the cluster's termination reason.|Confirm the NM no longer reports a limit violation and the original action produces the expected output.`);
entry('driver-heap','error','execution/memory','Driver JVM runs out of heap',
 'driver OutOfMemoryError;driver Java heap space;driver GC overhead limit exceeded','error-driver-out-of-memory best-pratice-collect big-broadcast-join','tuning config plan','case-17 range-sample broadcast-size lineage','17 26 31',
 'Applies to the JVM holding SparkContext; a Python MemoryError or YARN container kill is a different path.',`
Does driver heap grow while collecting rows or building a broadcast?|Locate the action and physical exchange. Compare result bytes or build-side size with available driver heap, allowing for deserialization and concurrent work.|Write or aggregate distributed results; for broadcast remove an inappropriate hint or reduce the build side. Increase heap only after bounding the workload.|Compare returned record count, physical join strategy and peak driver heap, not just a higher limit.
Does the failure precede useful tasks or worsen on every iteration?|Compare file counts, task/stage counts, plan depth and retained UI data across runs. A small dataset can still generate extensive metadata.|Compact excessive file listings, simplify or checkpoint a growing plan, or reduce retained UI history when that is the measured owner.|Check time to first task and driver memory over several iterations, with identical output.`);
entry('executor-heap','error','execution/memory','Executor JVM heap or GC exhaustion',
 'executor Java heap space;executor OutOfMemoryError;GC overhead limit exceeded;ExecutorLostFailure','error-executor-out-of-memory error-shuffle','tuning ui','case-16 large-row key-skew shuffle-width','12 16 32',
 'Use executor stderr and the earliest failed task. ExecutorLostFailure alone does not identify the cause.',`
Is one task much larger than its peers on repeated attempts?|Compare max versus median shuffle read, group cardinality and any single exceptionally large row. Follow the partition across hosts.|Split genuinely divisible work, handle hot keys, or remove an unbounded per-key collection. More executors alone do not divide one key.|Re-run with the same data and compare the largest task, completion and output cardinality.
Do many similarly sized tasks run concurrently with high GC on the same executor?|Inspect executor cores, task concurrency, persisted datasets and peak JVM memory; compare with YARN total RSS.|Reduce the per-task working set or simultaneous tasks per executor, release unnecessary caches, then size heap within the container allowance.|Compare GC fraction, spill, throughput and number of lost executors; ensure the bottleneck did not move to disk.`);
entry('python-memory','error','execution/memory','Python worker or Arrow group exhausts memory',
 'MemoryError;ArrowMemoryError;Arrow allocation failed;Python worker exited unexpectedly;PythonException out of memory','pyudfoom container-oom failure-executor-large-record','python yarn','case-16 key-skew large-row','08 12 16 29',
 'Distinguish batched scalar/iterator APIs from APIs that materialize an entire group; behavior also depends on Spark and PyArrow versions.',`
Is a grouped or cogrouped operation materializing a very large key?|Measure the largest group and inspect the Python operator in the plan; look at RSS of the worker, not only JVM heap.|Project unused fields out and use a partial/native aggregation if semantics permit. Do not assume a row-per-batch setting splits a whole logical group.|Verify identical per-key results and bounded peak group memory on the previously failing key.
Is memory proportional to Arrow batch width rather than one whole group?|Inspect input columns, long strings/arrays and records per batch for the actual operator. Compare a smaller representative batch.|For a batch-limited API reduce spark.sql.execution.arrow.maxRecordsPerBatch and narrow input columns. Budget Python/native memory in the container.|Compare worker RSS, batch throughput, row counts and the original failing input; avoid shrinking batches indefinitely.`);
entry('driver-stack','error','execution/memory','StackOverflowError in driver planning or serialization',
 'StackOverflowError;java.lang.StackOverflowError','error-driver-stack-overflow toobigdag','tuning plan','lineage driver-heap','31',
 'Stack depth and heap capacity are different. The predecessor article has a misleading heap-oriented title.',`
Does the stack repeat planning, expression traversal, or serialization frames?|Inspect a bounded stack excerpt, iteration count, logical plan depth and chained transformations. Confirm the exception actually originates on the driver.|Flatten deeply nested expressions and break long iterative plans at a materialized checkpoint or durable intermediate.|Run several more iterations and verify plan depth no longer grows without bound.
Are the repeating frames in user code instead?|Identify the first application frame and reproduce on a tiny fixture without increasing input size.|Fix the recursive algorithm or missing termination condition. Do not apply a large per-thread stack setting as a blanket fix.|Confirm bounded stack depth for deep-but-valid inputs and compare output with a known-good sample.`);
entry('disk-full','error','execution/memory','Executor local storage is full',
 'No space left on device;DiskBlockObjectWriter;ENOSPC;DiskErrorException','error-executor-out-of-disk toobigdag','yarn tuning','case-32 lineage skewed-write','07 11 32',
 'Distinguish local shuffle/spill storage from a destination quota on HDFS or an object store.',`
Does the failing path belong to a NodeManager local directory?|Read the executor path and NM disk report; compare free bytes and inodes per local volume. On YARN check the effective LOCAL_DIRS.|Have the cluster operator restore adequate healthy local capacity. Do not delete live shuffle files from active applications.|Check disk headroom through the peak shuffle and that the same stage completes without fetch failures.
Is the application continuously retaining intermediate data or spilling one hot reducer?|Compare staged bytes, spill, hot keys, persisted RDDs, and iteration lifetime. Identify who owns the growing files.|Unpersist unused caches, limit live lineage and reduce oversized partition work. If the error is at the final destination, address its quota separately.|Track disk usage across iterations rather than only at start, and reconcile final output.`);
entry('large-row','error','execution/serialization','One record exceeds the representation limit',
 'Cannot grow BufferHolder;size limitation 2147483632;Cannot allocate contiguous bytes;record too large','failure-executor-large-record pyudfoom','tuning plan','kryo-limit python-memory key-skew','26 29',
 'A single wide row, array, or collect_list output cannot be split merely by increasing partition count.',`
Does the failure follow one oversized record or one huge aggregate value?|On a safe sample measure payload lengths and group cardinalities before/after aggregation; inspect generated row/BufferHolder or serializer frames.|Change the representation: emit multiple bounded records, keep external payload references, or aggregate bounded summaries rather than one giant collection.|Check the maximum serialized row size and reconstruct a sample to verify data was not silently truncated.
Are ordinary rows individually small but the Python batch is wide?|Compare projected column widths and operator type; distinguish one massive group from batches of independent rows.|Use the Python-memory investigation and reduce batch size only where the API permits it.|Verify the largest group or batch separately and confirm full-row semantics.`);
entry('kryo-limit','error','execution/serialization','Kryo serialization buffer overflow',
 'KRYO_BUFFER_OVERFLOW;KryoException: Buffer overflow;Kryo serialization failed: Buffer overflow;Kryo buffer overflow;Kyro buffer overflow',
 'driver-max-result-size failure-executor-large-record','tuning config','large-row task-size case-17','17 25',
 'This is a serialization buffer for an object, not automatically the cumulative task-result budget.',`
Does the cause chain name the Kryo writer and a bounded but oversized object?|Record the serializer, where serialization occurs, actual object type, and current spark.kryoserializer.buffer.max. Compare with a representative serialized sample.|Prefer splitting or compacting the object. If its measured, bounded size genuinely fits available memory, evaluate a modest supported buffer increase on a test job.|Verify the same object round-trips and executor memory remains within limits.
Does the actual message instead name cumulative serialized results or the RPC task envelope?|Read the exact size, units, sender, and configuration name; the three limits protect different operations.|Follow case 17 for aggregate results or task-size for a launch description. Changing Kryo settings does not change those limits.|Verify the named failing boundary, not an unrelated size knob, is no longer exceeded.`);
entry('task-size','error','execution/serialization','Serialized task exceeds the RPC launch limit',
 'Serialized task was bytes which exceeds max allowed;spark.rpc.message.maxSize;max serialized task size','max_serialized_task_size','config tuning','case-25 kryo-limit case-17','25 33',
 'The driver checks the serialized task description before dispatch. This is not an executor returning too many result bytes.',`
Does the driver log name a serialized task and spark.rpc.message.maxSize?|Locate the offending stage; inspect captured state and data parallelized from a driver-side collection. Compare task size after removing the large input.|Read data from partitioned storage or send a compact handle. For reusable read-only task data use an appropriately sized broadcast; avoid capturing an enclosing object unnecessarily.|Confirm tasks actually launch and that the task-size message vanishes without changing results.
Is it only a large-task warning rather than the hard launch rejection?|Distinguish the warning text from the explicit size-limit exception, and check whether tasks execute.|Reduce unnecessary payload to improve dispatch; for an unrelated failed stage follow its first actual exception instead of increasing RPC limits.|Compare scheduler delay and the final task end reason in the UI.`);
entry('broadcast-size','error','execution/driver','Broadcast relation is too large or times out',
 'Cannot broadcast the table;Cannot broadcast table;Could not execute broadcast in;BROADCAST_TIMEOUT;broadcast exchange timeout;Cannot build hashed relation',
 'big-broadcast-join broadcast-with-disable error-driver-max-result-size','plan config','broadcast-despite-disable driver-heap case-17','09 17',
 'A hard size/row bound, heap exhaustion, and a wait timeout have different remedies.',`
Is the build relation above the supported limit or too large for driver/executor memory?|Read the BroadcastExchange metrics, built side, row estimates, hints, and sizes of simultaneously live exchanges; do not use compressed file size as in-memory size.|Project/filter the build side or remove a forced broadcast and choose a suitable shuffle join. A larger timeout cannot raise a size limit.|Verify the final physical plan and peak driver/executor memory, along with equal join results.
Does the exchange fit but spend the timeout waiting on its child job?|Inspect build-side task durations, scheduling/wait time and skew; check the exact timeout exception before altering settings.|Fix upstream scheduling or skew first. Extend spark.sql.broadcastTimeout only when a safe build is known to complete within the new window.|Verify completion time and build size over representative runs, not just a successful small test.`);
entry('broadcast-despite-disable','symptom','performance/sql','Broadcast appears despite disabling the automatic threshold',
 'BroadcastNestedLoopJoin;autoBroadcastJoinThreshold=-1;unexpected BroadcastExchange','broadcast-with-disable big-broadcast-join','plan sql','broadcast-size case-09','09',
 'Disabling automatic size-based broadcast does not prohibit all join strategies, hints, or adaptive decisions.',`
Does the final plan show a broadcast hint or a different adaptive threshold?|Inspect both initial and final plans, join keys, build side and effective session settings. Separate broadcast hash from broadcast nested loop.|Remove inappropriate hints and review the adaptive threshold for this query. Confirm an alternate strategy is supported by the join type.|Compare final physical operator, match counts and unmatched rows.
Is a non-equi or null-aware anti-join involved?|Inspect NOT IN and nullability on both sides. Check whether another algorithm preserves the exact SQL semantics.|Rewrite only after testing empty inputs, NULLs and duplicate keys. NOT EXISTS or a left join is not generally equivalent to NOT IN.|Compare original and revised results on the null/empty fixtures and validate the physical plan.`);
entry('range-sample','error','execution/driver','Driver result limit during range partition sampling',
 'RangePartitioner;rangeExchange.sampleSizePerPartition;range partition sampling;result size during sort','driver-max-result-size error-driver-max-result-size','config plan','case-17 driver-heap scan-layout','17 30',
 'A distributed sort can return sample keys to the driver even without a user collect().',`
Is the failed driver-side job collecting samples for a range exchange?|Check the SQL plan for range partitioning and match the failed job to the sorting stage. Compare key width and number of input partitions.|Remove an unneeded global sort, narrow the sort keys if semantics allow, or reduce excessive upstream input fragmentation.|Verify ordering requirements and compare driver sample volume on the same input.
Is sampling still too expensive with necessary sort keys?|Inspect the effective spark.sql.execution.rangeExchange.sampleSizePerPartition. Lower sampling may make boundaries less balanced.|Evaluate a smaller sample in isolation rather than disabling the driver result guard. Retain enough samples to avoid severe reducer imbalance.|Check max/median downstream partition sizes, ordered output and driver memory together.`);
entry('jvm-linkage','error','launch/submission','Missing JVM class or incompatible method at runtime',
 'ClassNotFoundException;NoClassDefFoundError;NoSuchMethodError;AbstractMethodError;LinkageError','class-or-method-not-found','yarn config','large-jar case-23','03 21',
 'Identify the failing JVM. A JAR present on the submit host is not proof it is available on an executor.',`
Is the named class missing from the classpath of the process that throws?|Check the root cause, runtime classpath, artifact contents, Scala binary version, and localized resources. NoClassDefFoundError can also follow a failed class initializer.|Supply the compatible dependency to the affected processes; fix the initializer if a previous exception explains the failure.|Load the class and exercise its actual call on driver and executor in a small job.
Is the class present but a method signature is missing?|Compare compile-time and runtime dependency versions and the JAR actually selected by the class loader. Inspect conflicting transitive artifacts.|Align versions with the cluster, exclude duplicates, or carefully relocate a private dependency. Avoid globally reversing classpath order as a first fix.|Repeat the exact method invocation on the original runtime and check there is one intended dependency path.`);
entry('large-jar','symptom','launch/submission','An oversized application JAR slows every launch',
 'fat jar;uber jar;large application jar;slow jar staging','toolargejar','yarn','case-21 jvm-linkage','21',
 'Distinguish the user application JAR from Spark staging its entire distribution.',`
Does staging time and uploaded size track the user artifact?|Measure before and after submission and list the largest entries in the built artifact. Check whether Spark/Hadoop or entire unrelated services are bundled.|Use provided dependencies for compatible cluster libraries; replace oversized client dependencies with the specific API needed. Preserve required runtime classes.|Compare artifact size, submit-to-AM time, and a worker-side dependency smoke test.
Is the large transferred object actually Spark's library ZIP?|Check the fallback staging warning and the name of the resource in the launch context.|Follow case 21 and distribute a compatible reusable Spark archive rather than deleting classes from the application.|Confirm the expected archive is reused and the resulting classpath still works.`);

entry('shuffle-meta','error','execution/shuffle','No map-output location for a shuffle partition',
 'MetadataFetchFailedException;Missing an output location for shuffle;missing map output status','error-shuffle shuffle_exchange_loses_exec_reg','config yarn','case-11 node-loss shuffle-registration','11 15',
 'Failure to obtain location metadata precedes opening a network stream to a block server.',`
Did a producer executor or node disappear before the reducer requested the map status?|Match shuffle ID and map index against driver stage attempts, YARN container reports and producer logs. Look for an earlier OOM or disk failure.|Treat the earliest producer loss, then allow Spark to regenerate missing map outputs subject to the stage budget; do not just retry stale addresses.|Check for a fresh successful map attempt, new location metadata, and a succeeding consumer.
Are producers alive but a serving service or registration changed?|Compare old and new serving address/port and service restart time. A lookup failure is not proof of network saturation.|Follow the shuffle-registration investigation if a restarted service lost mappings. Otherwise inspect driver map-output invalidation and prior failed stages.|Verify consumers can resolve *and* read the new output on the same shuffle.`);
entry('shuffle-network','error','execution/shuffle','Shuffle connection fails or times out',
 'FetchFailedException: Failed to connect;Connection refused;Connection reset;connection timed out;shuffle fetch timeout;closed channel',
 'error-shuffle','config yarn','shuffle-meta shuffle-frame case-14 node-loss','11 14',
 'Identify the remote serving port in the fetch error. Reaching the web UI or driver RPC endpoint does not test the shuffle path.',`
Do repeated failures point at one serving host or dead executor?|Compare the serving BlockManagerId (not just the reducer host), port, container timeline and service health. Separate refused connections from time spent transferring bytes.|Fix the endpoint or have the cluster owner repair the affected service/node. Recompute missing outputs when the original location is no longer valid.|Verify successful block reads from the intended service or a regenerated output, not just TCP connectivity.
Do many healthy hosts slow down only during high concurrent fetch load?|Compare remote bytes, fetch wait, disk throughput and service load over the failing window; distinguish a single huge block.|Bound fetch concurrency or rebalance measured partition sizes; consider network timeout/retry changes only for demonstrated transient stalls.|Compare fetch wait and retry rate under equivalent load while checking stage duration and total output.`);
entry('shuffle-checksum','error','execution/shuffle','Shuffle block is corrupted',
 'is corrupted but the cause is unknown;corrupt shuffle block;checksum mismatch;shuffle checksum','shuffle_fetch_corrupted error-shuffle','config yarn','shuffle-network node-loss case-11','11',
 'Checksum or decompression failure is evidence about bytes, not proof a particular disk is defective.',`
Do corrupt blocks from different reducers share a serving host or disk?|Group failures by serving host, shuffle ID and map output. Compare worker disk alerts, checksum diagnostics, and whether recomputed output elsewhere reads successfully.|Preserve diagnostics; ask the operator to investigate or isolate that host under cluster policy. Regenerate affected outputs rather than reusing the corrupt file.|Read regenerated blocks on a healthy path and verify the same workload no longer produces checksum failures.
Do failures persist on different hosts for the same records?|Check whether decoding is failing on source files or on the shuffle stream. Compare producer output, codec/version and first offending input.|Investigate the input or producer deterministically on a small fixture. Do not disable corruption detection simply to obtain a green stage.|Verify successful decoding and equal aggregate checks on the original input snapshot.`);
entry('shuffle-registration','error','execution/shuffle','External shuffle service lost executor registrations',
 'Executor is not registered;not registered with the external shuffle service;shuffle service restarted;unRegisterOutputOnHost',
 'shuffle_exchange_loses_exec_reg error-shuffle','yarn config','shuffle-meta node-loss','11 15',
 'A service process can be reachable after restart while its per-executor registrations are missing. This case is version/configuration dependent.',`
Did the external shuffle service restart on the common serving node?|Correlate NM/service logs with unknown executor IDs and old map locations. Confirm external shuffle service is actually enabled.|Repair service registration/recovery for the deployed Hadoop/Spark versions. Review the documented host-output invalidation option with the cluster operator, not as a blanket tuning change.|Verify new executor registration, invalidation/recomputation of unusable outputs, and actual reducer reads after a controlled restart.
Is the service healthy but output files are absent?|Check local directory retention and node loss rather than assuming a registration bug.|Follow missing map output or producer failure. Increasing fetch retries does not restore deleted files.|Verify the map stage supplies a new readable location.`);
entry('shuffle-frame','error','execution/shuffle','Shuffle transfer reports a frame or buffer size limit',
 'Too large frame;frame size exceeding;Integer.MAX_VALUE;shuffle block too large','error-shuffle failure-executor-large-record','config tuning','large-row key-skew shuffle-network','10 11',
 'Do not infer a universal 2 GiB file limit. The transport, protocol, block representation and Spark version matter.',`
Is the failing message on the data-transfer connection with an exceptionally large block?|Read block IDs, sizes and serving address; compare max/median shuffle read and the distribution of keys. Exclude an incorrect service or port.|Reduce individual shuffle-block size with suitable upstream partitioning; for a dominant key, change the aggregation or split it correctly rather than adding partitions blindly.|Check the largest blocks, retries and result equivalence, not just the total number of shuffle partitions.
Is the error from an encoder building one row or from a misdirected connection?|Inspect the first stack frame and whether the peer really speaks Spark block transfer.|For BufferHolder use the single-record investigation; for a wrong service address fix the endpoint configuration. Do not raise unrelated RPC task limits.|Verify a known small block crosses the same path and the original failing input is readable.`);
entry('node-loss','error','execution/executor','Multiple executors disappear from one YARN node',
 'Node lost;node marked unhealthy;DISKS_FAILED;ExecutorLostFailure;lost node','error-shuffle slow-executor','yarn ui','case-14 case-15 disk-full case-11','14 15 20',
 'Separate a failed worker host from one executor preemption, one missing heartbeat, or an application-wide AM loss.',`
Do multiple containers or applications on the same host share the loss timestamp?|Match NM health and disk diagnostics with container IDs in YARN and Spark. Distinguish serving host from fetching host.|Have the operator restore or drain the node as appropriate. Allow Spark to replace executors and rebuild only missing shuffle output.|Verify healthy NM reports, registered replacement executors and successful reads from replacement producers.
Did only one container die while the NM remained healthy?|Read its exit reason and earliest stderr; a host name in a FetchFailed message is not proof of node loss.|Follow container memory, preemption or heartbeat expiry as supported by diagnostics.|Confirm a replacement on a healthy host completes the original partition.`);
entry('sql-analysis','error','execution/analysis','SQL AnalysisException: identify the rejected expression',
 'AnalysisException;UNRESOLVED_COLUMN;AMBIGUOUS_REFERENCE;TABLE_OR_VIEW_NOT_FOUND;UNRESOLVED_COLUMN.WITH_SUGGESTION',
 'error-sql-analysis error-job','sql plan','sql-correlation wrong-format','35 36',
 'Analysis can fail on the driver before any executor tasks start. Prefer the structured error condition over the wrapper class.',`
Does the error name an unresolved or ambiguous column?|Inspect the analyzed input schemas, alias scope, capitalization/resolver settings and columns introduced by a join. Use the identifier in the exception.|Select or qualify the intended column with a relation alias; avoid renaming away distinct columns without checking their meaning.|Analyze the query and run a tiny fixture with both sides populated to validate the projected columns.
Does the error name a missing relation or an unsupported subquery instead?|Check active catalog/schema and temporary-view session; for correlated references inspect the subquery condition and outer column.|Qualify/register the relation in the correct session or follow the correlated-subquery investigation. Formatting SQL can clarify scope but cannot fix a rejected semantic rule.|Verify the analyzed plan resolves the intended table and check null/no-match behavior.`);
entry('sql-correlation','error','execution/analysis','Correlated predicate rejected during analysis',
 'CORRELATED_COLUMN_IS_NOT_ALLOWED_IN_PREDICATE;Correlated column is not allowed in predicate;UNSUPPORTED_SUBQUERY_EXPRESSION_CATEGORY',
 'correlated-column-not-allowed error-sql-analysis','sql plan','sql-analysis broadcast-despite-disable','35',
 'Support depends on the Spark version, predicate shape and aggregation. A rewrite must preserve outer-row multiplicity and empty-input semantics.',`
Is an outer reference inside an unsupported correlated aggregate predicate?|Identify inner/outer attributes in the analyzed-query error and the expression that joins them. Check the error subclass for the deployed version.|Where equivalent, compute inner aggregates on suitable keys then join them back to outer rows. Preserve unmatched outer rows and COUNT-on-empty semantics explicitly.|Test no match, one match, duplicates and NULL keys; compare with a trusted reference result.
Does the same query fail as an ordinary name-resolution issue without correlation?|Check the actual identifier and aliases in a minimal query before restructuring the join.|Resolve the names and scopes first; do not rewrite a valid scalar query based only on the AnalysisException superclass.|Verify analysis completes and the minimal query returns the expected cardinality.`);
entry('wrong-format','error','data/files','Parquet reader opened a non-Parquet file or wrong table',
 'not a Parquet file;not a Parquet file. Expected magic number;Expected magic number at tail;CANNOT_READ_FILE_FOOTER','failed-to-read-non-parquet-file error-invalid-file error-other','parquet sql','damaged-input case-36 case-37','36 37',
 'A filename suffix or table declaration is not proof of the bytes on disk. Do not switch metastores without checking the table identity.',`
Does the exact reported path contain a different format or unexpected side file?|Use a trusted file inspector on a copy; check the file footer and producer metadata. Compare a known-good Parquet file and the table location.|Correct the reader, table location or upstream format. Place ancillary files outside the dataset according to the table contract.|Read the repaired table from a fresh session and reconcile the expected paths, row count and values.
Is the format right but the file truncated or the catalog points at the wrong snapshot?|Compare file length, producer commit evidence and catalog snapshot. Distinguish decoding errors from a missing file.|Restore an intact version or republish using appropriate commit semantics; do not delete catalog metadata indiscriminately.|Verify the complete snapshot reads a data column and downstream totals match.`);
entry('damaged-input','error','data/files','File decoder reads past a page or stream',
 'Reading past RLE/BitPacking stream;ParquetDecodingException;EOFException;unexpected end of stream','error-invalid-file failed-to-read-non-parquet-file','parquet config','wrong-format case-36 shuffle-checksum','36 37',
 'An EOF in a stored data file is not automatically a corrupt shuffle block or a type mismatch.',`
Does decoding fail at the same file and column across different executors?|Read that file alone with its native schema and a selected column. Check size, checksum if available, producer version and a known-good fixture.|Restore or regenerate the file from the source into a new snapshot. Align writer/reader versions when a minimal valid file demonstrates a compatibility issue.|Reconcile values and counts for that file and the full repaired snapshot, not just footer readability.
Does the failure move between paths or coincide with overwrite/publication?|Check listing and read timestamps against writers, and compare with the snapshot's file manifest.|Use immutable or transactional publication, then retry against a stable version. Only skip corruption if partial results are part of an explicit policy.|Verify that repeated reads of the same snapshot agree and account for every expected file.`);
entry('capacity-wait','symptom','launch/capacity','Tasks wait but the cluster does not deliver more slots',
 'Initial job has not accepted any resources;pending containers;not enough executors;slow cluster','notenoughexecs slow-job-slow-cluster slow-job','yarn ui','case-01 case-03 case-05 case-30','01 03 05',
 'Separate target demand, RM grants, successful JVM launch, and executor registration.',`
Are eligible container requests pending in the YARN queue?|Compare driver target, AM pending requests, queue capacity, node labels and resource dimensions. Queue wait can occur before any executor log exists.|Meet the queue/resource constraints or arrange capacity with its owner. Raising the dynamic-allocation maximum is not a remedy for no grants.|Verify grants become registered executors and runnable tasks begin.
Are containers granted but Spark shows no ready executors?|Inspect bootstrap logs and advertised driver address; if executors are idle, count runnable partitions instead.|Use executor-registration diagnostics for failed bootstrap or narrow-stage diagnostics for insufficient runnable work.|Compare pending tasks, registered slots and active cores on the same timeline.`);
entry('lineage','symptom','performance/work','Iterative application accumulates a long lineage or SQL plan',
 'large DAG;iterative job slower each iteration;long lineage;deep logical plan','toobigdag error-driver-stack-overflow error-executor-out-of-disk','tuning plan','driver-stack driver-heap case-31','07 31',
 'Caching work is not the same as cutting dependencies; a growing plan is one hypothesis, not a diagnosis from DAG size alone.',`
Does planning time, lineage depth or retained shuffle state grow with iteration number?|Compare equivalent iterations, input size, retained references and driver profiles. Exclude growing data volume as the simpler explanation.|Periodically materialize a reliable checkpoint or explicitly write/read a correct intermediate; release obsolete caches and references.|Prove lineage is truncated after materialization, later iterations stabilize, and the algorithm returns the same result.
Does time instead grow after task launch with unchanged plan depth?|Compare per-iteration input sizes, spill and hot keys in the Stages UI.|Investigate skew or disk pressure rather than checkpointing every iteration. Checkpoint I/O itself has a cost.|Verify the dominant stage metric improves over multiple iterations.`);
entry('key-skew','symptom','performance/shape','One key dominates shuffle or group work',
 'key skew;hot key;skewed aggregation;skewed shuffle tasks','key-skew slow-skewed-join slow-reduce revise-bad_partitioning','plan tuning','case-10 case-29 python-memory slow-host','10 29',
 'Long duration alone is not evidence of skew. Check bytes, records and key frequency together.',`
Does the long tail follow a key or partition across different hosts?|Compare max/median records and bytes and a bounded key-frequency profile. Check whether a single group must fit together.|Use partial aggregation where valid; isolate verified hot keys or use an eligible AQE skew join. Salting requires a correct second combine or join-side replication.|Verify result multiplicity and per-key totals plus a smaller slowest task, accounting for extra shuffle reads.
Are byte counts comparable and only one host is persistently slow?|Compare several partitions on that host and a matched task elsewhere; inspect GC, I/O and CPU stalls.|Use slow-host diagnostics. Do not salt keys or change exact aggregations based on duration alone.|Re-run on comparable resources and confirm the slowdown follows or no longer follows the host.`);
entry('shuffle-width','symptom','performance/shape','Shuffle parallelism does not match the work',
 'too many shuffle tasks;too few shuffle tasks;uniform slow reducers;tiny tasks;too many tasks;too few tasks',
 'slow-reduce toofew_tasks toomany_tasks even_partitioning_still_slow revise-even_partitioning_still_slow revise-bad_partitioning','plan tuning ui','case-34 case-32 key-skew case-30','28 30 32 34',
 'Initial shuffle buckets, final AQE reader tasks, and YARN container counts are separate controls.',`
Are most reducers uniformly large and long-running, with idle slots available?|Compare partition bytes/durations and actual allocated slots. Exclude one hot key and operators that require a single partition.|Increase applicable shuffle parallelism before that exchange, or improve input layout. Do not use queue changes to split a deterministic single-partition operator.|Compare peak partition size, spill and stage duration at equivalent input size.
Are most tasks tiny compared with scheduling and fetch overhead?|Check scheduler delay, bytes per task, CPU use, and the final adaptive plan. A large number of buckets need not imply that many reader tasks.|Enable or tune eligible AQE coalescing, or reduce excessive initial partition counts. Preserve required distribution and adequate concurrency.|Verify less scheduling overhead without creating a small set of large stragglers.`);
entry('slow-host','symptom','performance/shape','One executor is slow on otherwise comparable tasks',
 'slow executor;slow host;straggler;same partition fast on another host','slow-executor even_partitioning_still_slow revise-even_partitioning_still_slow','ui tuning','key-skew case-13 case-14','13 14',
 'A slow machine and a large partition can look identical until host and partition IDs are separated.',`
Are unrelated, similarly sized tasks slow on the same host?|Compare input bytes, shuffle read, GC time, locality, attempt number and duration by executor across stages.|Investigate that host with the operator for disk/network contention or memory pressure. Speculation can reduce tail latency but duplicates work.|Compare matched tasks after remediation and ensure external side effects remain safe for repeated attempts.
Does slowness move with one partition rather than one host?|Compare the same partition across attempts and sample data complexity as well as bytes.|Follow skew, oversized record or CPU-expensive transformation diagnostics; replacing healthy nodes will not fix that input.|Verify the partition tail shrinks without altering the output.`);
entry('scan-layout','symptom','performance/read','Input layout produces too many tiny or too few large scan tasks',
 'slow map;unsplittable input;small file scan;too many input splits','read-partition-issue slow-map revise-bad_partitioning','plan parquet tuning','scan-volume key-skew small-files','30 35 40',
 'Input splits are determined by the data source and file layout before the later shuffle partition setting applies.',`
Is planning/listing expensive and are files or read tasks mostly tiny?|Inspect file count/size, listing time, scan partition count, and per-task duration. Account for source-specific open cost and grouping.|Compact small files through a controlled rewrite or use appropriate source split settings; do not edit table-owned files in place.|Verify lower listing/task overhead with the same row and partition totals.
Is one large input task reading a non-splittable file or an unusually large record?|Check actual codec, file layout, row groups and input bytes in the first stage. A downstream repartition happens after this read.|Use a splittable representation or rewrite into appropriately sized files; treat a single excessive row separately.|Verify the read stage itself distributes work, not just a subsequent shuffle stage.`);
entry('scan-volume','symptom','performance/read','Scan reads more partitions, columns or rows than necessary',
 'PartitionFilters;PushedFilters;ReadSchema;column pruning;predicate pushdown','slow-map slow-partition_filter_pushdown','plan parquet','case-35 scan-layout case-08','08 35',
 'Partition pruning, column pruning and storage-level predicate pushdown are not interchangeable.',`
Are expected partition predicates absent or does the scan open more directories than required?|Use formatted explain and actual file counts; inspect expressions, types, catalog metadata and dynamic pruning eligibility for the deployed version.|Express the intended partition predicate in a form the source can use. Verify rewrites for nulls and dates before relying on them.|Check selected partitions and bytes read; confirm output equivalence.
Are directories correct but ReadSchema is wide or data filters run above a UDF?|Compare requested columns, pushed filters and Python evaluation boundaries. Source capabilities may limit pushdown.|Project only needed columns and apply equivalent native filters before opaque transformations where semantics allow.|Compare scan schema, bytes, UDF input rows and output values.`);
entry('regex-cpu','symptom','performance/read','Tasks spend most of their time in regular-expression matching',
 'regexp_extract;regexp_replace;java.util.regex.Pattern;regex slow','slow-regex-tips slow-map','ui plan','case-08 slow-host large-row','08',
 'Investigate performance on benign bounded data. A busy task with little I/O is not automatically a regex problem.',`
Do executor profiles repeatedly show regex matching on the slow records?|Compare task CPU versus I/O and sample representative input lengths. Check whether the expression is interpreted by SQL, Python or the JVM.|Replace unnecessary regex work with a literal/string operation or simplify the expression while preserving intended matches. Scope evaluation to the rows/columns that need it.|Compare match and nonmatch results, escaping, nulls and runtime across representative bounded inputs.
Is apparent slowness actually an unexpected escape or match result?|Compare the string that reaches the regex engine with the intended literal, including the SQL/Python string layer.|Fix escaping at the relevant layer and add small positive and negative examples; do not assume one number of backslashes suits every interface.|Verify outputs explicitly rather than using a count that prunes the expression.`);
entry('benchmark','symptom','performance/read','A benchmark action silently skips the expression under test',
 'forced computations;noop write;count prunes projection;benchmark too fast','forced-computations slow-stage','plan ui','scan-volume case-08','08 36',
 'A benchmark that counts rows may never materialize the projected column, UDF or problematic conversion.',`
Is the target expression missing from the executed plan?|Compare the optimized/physical plan for count versus an action consuming the target column; keep input and cache state identical.|Consume a bounded checksum/aggregate over the actual values, or use an appropriate no-op sink for the exact runtime. Separate sink I/O from transformation measurement.|Verify the target operator executes, its metrics are nonzero and representative values agree.
Do runs differ in warm caches, AQE decisions or cluster allocation?|Compare input versions, final plan and executor resources before calling one implementation faster.|Use a stable fixture and replicate warmed/cold measurements separately; report what the action measures.|Check the distribution across repeated runs rather than one elapsed time.`);
entry('stage-regression','symptom','performance/read','Find the stage responsible for a slow run',
 'slow stage;job slower than baseline;slow map stage;slow reduce stage','slow-job slow-stage slow-map slow-reduce slow-job-slow-cluster','ui tuning','capacity-wait scan-layout shuffle-width slow-host','05 10 32',
 'Stage IDs can change between applications. Compare operations and data sizes, not raw stage numbers alone.',`
Is elapsed time mostly before tasks run or while tasks wait for capacity?|Align submission, AM registration, grants, executor registration and first-task times from both runs.|Investigate staging or queue wait before tuning SQL operators. Ask for additional resources only if runnable tasks and eligible requests exist.|Verify time to first usable slot and pending-task duration improve.
Is an equivalent scan, exchange or write stage slower at the same input volume?|Compare final plans, task distributions, GC, spill, shuffle and output metrics. Separate global slowdowns from one outlier.|Follow the corresponding scan, shuffle, skew or commit investigation. Change one factor at a time on a comparable snapshot.|Verify the specific stage and end-to-end runtime improve with the same output.`);
entry('small-files','symptom','data/write','Write or subsequent scans suffer from too many small files',
 'small file problem;many part files;too many output files','slow-writes-too-many-files slow-writes read-partition-issue','plan cloud','case-40 skewed-write object-commit','30 39 40',
 'Concurrent writer tasks, dynamic partition directories, bucketing and rollover can all multiply file count.',`
Does file count track writer tasks times directories visited by each task?|Measure data files per destination partition, size distribution, number of writer tasks and maxRecordsPerFile. Ignore marker files.|Distribute by an appropriate output key and target file size, or compact using the table format. Avoid globally coalescing to one by default.|Compare files per directory, median size, subsequent scan time and full row totals.
Does a single successful task create several files with incrementing counters?|Inspect per-file row counts against the configured record cap.|Follow case 40. Raise the cap only if rollout really is the cause and the resulting file sizes suit readers.|Verify fewer files without turning the writer stage into a straggler.`);
entry('skewed-write','symptom','data/write','Some output partitions finish long after all the others',
 'skewed write;slow writes;sort before write;uneven output file sizes','slow-skewed-write slow-writes key-skew write-fails','plan ui','key-skew small-files object-commit','10 30 39',
 'The table partition key and the Spark execution partition are different. Sorting alone does not necessarily rebalance task load.',`
Does a late writer handle a disproportionately large date or key?|Compare per-task bytes and the target partition paths, including the final AQE plan and table distribution requirements.|Use a compatible repartitioning strategy that spreads hot data without breaking the table contract; local sorting changes order, not global balance.|Check max/median writer duration, partition directories, file sizes and result counts.
Do tasks finish promptly but the driver lingers after the last task?|Inspect driver commit logs and filesystem operations rather than adjusting reducer count.|Follow object-store commit or job-commit diagnostics; use an appropriate table-aware maintenance strategy for existing small files.|Verify publication latency and read-back integrity separately from task runtime.`);
entry('object-commit','symptom','data/write','Object-store publication is slow or incomplete',
 'S3A committer;rename slow on S3;FileOutputCommitter;slow S3 write','slow-writes-s3 slow-writes write-fails','cloud config','case-18 small-files write-stage','18 39',
 'S3, Hadoop/S3A, EMRFS and table formats have different commit protocols. Directory rename is not a portable atomic transaction.',`
Does time accumulate after tasks finish in copy/rename or job commit?|Identify scheme, connector, committer class, table format and request metrics. Compare task output time with commit time.|Choose a supported cloud-aware committer or transactional table writer for the deployed stack. Validate overwrite and retry support before switching.|Test success, a bounded aborted write and a retry on a private prefix; verify visibility and absence of duplicate results.
Is commit fast but there are many tiny uploads or skewed writers?|Compare file count, multipart/upload metrics and per-task duration.|Follow file-layout or skewed-write diagnostics instead of changing commit semantics unnecessarily.|Compare throughput, file sizes and published record count at the same input volume.`);
entry('write-stage','error','data/write','Write action fails: locate the first failing boundary',
 'TASK_WRITE_FAILED;Job aborted while writing rows;write failed;FileAlreadyExistsException;commit denied','write-fails slow-writes','plan cloud','case-18 case-38 skewed-write wrong-format','18 38 39',
 'An exception at save() can originate in upstream computation, task write/commit, or job commit.',`
Does the same expression fail before the sink is invoked?|Use a bounded fixture and force materialization of the actual columns; a simple count can avoid the calculation. Check earliest executor error.|Fix the upstream conversion, UDF or memory issue before tuning the committer. Compare the same input and plan.|Verify the projection materializes, then write and read back a new scratch destination.
Did task data succeed but publication fail, or did the write never start?|Compare task commit messages and job commit diagnostics with save mode, destination ACLs/quota and table distribution rules.|Follow job commit for post-task failure or existing-path handling for skipped/rejected insertion. Inspect partial output before retrying.|Check committed visible files and expected contents rather than only successful task counters.`);
entry('handoff','error','execution/analysis','Unknown or wrapped exception: preserve the first cause',
 'Py4JJavaError;SparkException: Job aborted;Job aborted due to stage failure;unknown error','error-job error-other slow-job','ui yarn sql','sql-analysis memory-owner case-11 write-stage','12 18',
 'A top-level SparkException or Py4J wrapper is not a root cause. Keep uncertainty explicit.',`
Is there a nested error condition or a task/container diagnostic earlier in time?|Record the application and attempt IDs, SQL execution/stage/task IDs, first cause and which process emitted it. Compare one failing and one successful partition.|Select the specific error by its class or message. Do not tune heap, increase retries or delete files solely from a wrapper.|Confirm the chosen diagnosis predicts the original evidence and a bounded reproduction.
Is the first cause missing because the process terminated abruptly?|Inspect YARN attempt/container logs, process exit status, available event logs and node health; redact secrets before sharing anything.|Escalate to the cluster or data owner with versions, affected scope, timing, sanitized cause chain and a minimal fixture. Do not claim a fix without discriminating evidence.|Agree on a test that would separate the leading hypotheses, then repeat after collecting it.`);

const acceptance=[
 'The launch specification reaches YARN without exceeding per-container capability.', 'A context is initialized and the AM registers before timeout.',
 'The worker registers and becomes ready for tasks, not just a running container.', 'The final YARN status agrees with actual output publication.',
 'Pending tasks drain after additional usable slots register.', 'Only unprotected surplus idle executors are removed.',
 'Cached partition coverage and the recomputed result match expectations.', 'Plans differ at the expected Python boundary and null-case results agree.',
 'The measured build side fits and join multiplicity is unchanged.', 'The final adaptive plan and maximum task size confirm that the hot join split.',
 'Fresh map output is registered, transferred and consumed by a completed reduce attempt.', 'The malformed input is explicitly accounted for and the same task no longer fails.',
 'There is one accepted logical result and no duplicate external side effects.', 'Heartbeats stay timely and replacements stop under equivalent load.',
 'The lost attempt is classified correctly and replacement work finishes.', 'Peak container usage remains below the actual allocation for the offending input.',
 'The action returns the bounded summary, or distributed output reconciles to the expected total.', 'A fresh consumer reads the committed dataset, with no unaccounted partial output.',
 'Only the selected group stops; a different group and a subsequent action still succeed.', 'Attempt IDs distinguish restarts and previously published data is not duplicated.',
 'No fallback JAR ZIP is rebuilt; both the AM and executor load the intended classes.', 'The dependent reader starts only after terminal success and publication.',
 'Worker-side imports report the intended package version.', 'A Python action succeeds inside the worker using the required Python major.minor.',
 'The corrected closure returns the intended value without referencing the driver context.', 'The consumer stays bounded for the largest partition while returning equivalent records.',
 'Scan batches and returned matches explain all observed jobs.', 'The required ranking semantics hold on multiple groups, ties and boundary rows.',
 'Partial sums match original totals and measured shuffle traffic improves.', 'The upstream stages have the intended task counts and output is equivalent.',
 'The checkpoint path exists after materialization and later dependencies use it.', 'Output is correct and the original spill bottleneck improves or is demonstrably acceptable.',
 'A valid broadcast handle is used by each later task.', 'Reader group count and output in the final adaptive plan agree with measurements.',
 'Actual scan metrics show only the required partitions, with the same correct rows.', 'The repaired file reads a materialized amount column with the expected type and total.',
 'All required files and row counts are present in a stable snapshot.', 'Read-back distinguishes original preserved content from an intentionally replaced dataset.',
 'Touched partitions are replaced, untouched dates remain and per-date totals reconcile.', 'Count data files and rows per file; do not count marker files or attempts.'
];
// Use saved event logs or bounded controls for infrastructure problems. A reproduction
// is not an instruction to exhaust a cluster or corrupt a real dataset.
const comparisons={
 'memory-owner':'Take one failed application report and make a timeline from driver stderr, executor stderr, and YARN diagnostics. Verify the first failure belongs to the process you selected before trying any tuning change.',
 'driver-heap':'On a small fixed fixture compare collecting rows with a distributed summary or write. Inspect driver result bytes, plan, and heap observations; use a historical failure for the high-water mark rather than provoking OOM.',
 'executor-heap':'Compare a small uniform-key input with an equally sized hot-key input. Inspect max versus median task data and GC; use the failing executor log as the control for the original heap error.',
 'python-memory':'On bounded data compare a grouped Python operation with a native partial aggregation where equivalent. Record group cardinalities, selected column widths, worker RSS and results; do not recreate an OOM.',
 'driver-stack':'Build a short iterative transformation chain in a scratch job. Compare plan depth and repeated stack frames with a version that materializes an intermediate. Stop at modest depth.',
 'disk-full':'Use a saved ENOSPC diagnostic to identify the failing volume. In a scratch job measure spill and free bytes with and without unnecessary persistence; never fill a shared volume.',
 'large-row':'Use small synthetic arrays of increasing length or a bounded collect_list group. Measure row size before and after aggregation; demonstrate the growth trend without approaching an encoder limit.',
 'kryo-limit':'Serialize a representative bounded object with the application serializer. Compare the original representation with a compact or split form, confirming the decoded values are equivalent.',
 'task-size':'Compare the driver-reported task size of a small job capturing a bounded lookup with the same logic referencing a broadcast handle. Do not increase RPC limits to manufacture success.',
 'broadcast-size':'Run the same small equi-join with and without an explicit broadcast hint. Inspect the exchange build side, timing and output. Use event logs to compare with the large failing case.',
 'broadcast-despite-disable':'Use a tiny left/right SQL fixture, including a NULL on the right, and inspect the final plan with the automatic threshold disabled. Compare NOT IN with any proposed rewrite and record differing rows.',
 'range-sample':'Compare sorting narrow and deliberately wider keys on the same small multi-partition fixture. Inspect the sampling job, returned sample bytes and downstream imbalance while keeping output ordering requirements fixed.',
 'jvm-linkage':'Run a minimal call to the affected class on the driver and in one executor task using the production artifact set in a private test application. Record the JAR origin and exact method signature.',
 'large-jar':'Build two artifacts from the same application, one with cluster-provided libraries excluded. Compare archive contents, staging time and a worker-side call that exercises dependencies.',
 'shuffle-meta':'Use the DAGSchedulerSuite fetch-failure fixture linked in case 11. Compare an unavailable map location with a failure opening a known location; note which operation happened first.',
 'shuffle-network':'Correlate one saved failed fetch and a successful fetch for the same shuffle with the actual serving address, bytes and wait time. Use a healthy scratch shuffle as a control; do not interrupt networking.',
 'shuffle-checksum':'Compare recorded corrupt-block diagnostics by source host and block ID with a clean rerun of the same input. Do not change checksums or modify shuffle files on a live cluster.',
 'shuffle-registration':'Compare one service restart timeline with its registration logs, executor IDs and subsequent fetch attempts. Use an operator-approved service recovery fixture when a restart test is necessary.',
 'shuffle-frame':'From a failed event log, compare the oversized transfer with the distribution of other blocks. Use a smaller sample with the same skewed key pattern to compare partitioning strategies.',
 'node-loss':'Replay a saved NM-unhealthy or lost-node event. List every lost container on that host in the same time window and compare an unaffected host. No node shutdown is needed.',
 'sql-analysis':'Use two tiny DataFrames with the same column name, join them and select an unqualified ambiguous column. Compare with a qualified projection; inspect the condition rather than assuming every AnalysisException has this cause.',
 'sql-correlation':'Reduce the actual failing query to two small relations containing unmatched rows, duplicates and NULLs. Compare the relevant correlated query or trusted reference with the proposed aggregate/join rewrite on your Spark version.',
 'wrong-format':'Write a small text file to an isolated path and deliberately read that scratch path as Parquet; contrast with a known-good Parquet file. Compare magic/footer diagnostics with a valid file of incompatible schema.',
 'damaged-input':'Use an already quarantined file or a test fixture and its known-good original. Read the offending column explicitly and compare footer, length and failure location; do not alter production files.',
 'capacity-wait':'Compare the time series of target, requested, allocated, registered and busy executors in one waiting run. Contrast with a bounded job that has adequate queue resources and enough runnable tasks.',
 'lineage':'Run a bounded iterative RDD example with and without a periodic reliable checkpoint. Compare dependency depth and iteration time after materialization; check identical results.',
 'key-skew':'Profile a small dataset with one frequent key and many rare keys. Compare task-size distribution and per-key totals before and after an eligible partial aggregation or AQE join.',
 'shuffle-width':'Run a bounded groupBy with the same input at two sensible initial shuffle counts. Compare final AQE reader partitions, peak task size and scheduling overhead; keep executor capacity constant.',
 'slow-host':'Use an event-log comparison, grouping comparable attempts by host and partition. A tail that follows a host suggests a different investigation than one that follows the same partition everywhere.',
 'scan-layout':'Write the same small dataset as many tiny files and as a compact file set in separate scratch paths. Compare planning time, scan tasks and total rows.',
 'scan-volume':'Use a partitioned test table, select only needed columns and compare a partition-key filter with a non-key filter. Inspect actual scan files, read schema and output values.',
 'regex-cpu':'Compare the original transformation against a simpler equivalent expression on bounded representative inputs including nonmatches, NULLs and escaped literals. Verify semantics before interpreting timings.',
 'benchmark':'Create a projected column and compare count() with an aggregation that consumes the projected value. Use the final physical plans to check whether each action executed the expression.',
 'stage-regression':'Open the SQL and Stages views for a known-good and a slow run on equivalent inputs. Match operators, bytes and task distributions before comparing stage duration.',
 'small-files':'Write identical rows to two fresh paths with different writer parallelism or rollover cap. Count data files and compute size distribution by destination partition.',
 'skewed-write':'Write a bounded dataset containing one hot date; compare per-writer bytes and elapsed time with a better balanced, table-compatible distribution, then reconcile all dates.',
 'object-commit':'Write and read back a tiny fixture in a private object-store prefix with the supported connector/committer. Compare task completion timestamps to final publication; test retry only on scratch output.',
 'write-stage':'Use the V1 failing-job-commit fixture from case 18 to isolate failure after task commits. Contrast with a projection error that fails before the sink gets valid rows.',
 'handoff':'Reduce the incident to one application attempt and the smallest representative input. Record the first nested cause, not just the terminal exception; if logs are missing, document that gap.'
};
const graphTargets={
  A:'handoff', B:'stage-regression', C:'handoff', OHNOES:'handoff',
  Error:'handoff',MemoryError:'memory-owner',ShuffleError:'case-11',SqlAnalysisError:'sql-analysis',WriteFails:'write-stage',OtherError:'handoff',
  SchemaColumnConvertNotSupportedException:'case-36',TooLargeJar:'large-jar',LostShuffleFiles:'shuffle-meta',ShuffleFetchCorrupted:'shuffle-checksum',
  ShuffleExchangeLosesExecReg:'shuffle-registration',NodeFailures:'node-loss',Serialization:'task-size kryo-limit',KyroBuffer:'kryo-limit',
  MaxSerializeTask:'task-size',DriverMaxResultSize:'case-17',DriverMemory:'driver-heap',ExecutorMemory:'executor-heap',DriverMemoryError:'driver-heap',
  TooBigBroadcastJoin:'broadcast-size',ContainerOOM:'case-16',ExecutorMemoryError:'executor-heap',ExecutorDiskError:'disk-full',LARGERECORDS:'large-row',
  SlowJob:'stage-regression',SlowStage:'stage-regression',SLOWSTAGE:'stage-regression',SlowMap:'scan-volume',SlowReduce:'shuffle-width',SLOWWRITESTOSTORAGE:'skewed-write object-commit small-files',
  TOOBIGDAG:'lineage',SlowCluster:'capacity-wait',PAGGS:'case-29',TooFewShuffleTasks:'shuffle-width',TooManyShuffleTasks:'shuffle-width',
  SkewedShuffleTasks:'key-skew',SpillToDisk:'case-32',SkewedJoin:'case-10',SkewedAggregation:'key-skew',TOOMANYFILES:'small-files',
  SkewedWrite:'skewed-write',S3COMMITTER:'object-commit',UDFSLOWNESS:'case-08',FILTERNOTPUSHED:'case-35',TOOMANY:'shuffle-width',
  TOOFEW:'case-30',NOTENOUGHEXEC:'capacity-wait',SHUFFLEPARTITIONISSUES:'shuffle-width',READPARTITIONISSUES:'scan-layout'
};
export function buildKnowledge(cases,inventory){
  const base=guides.map(([num,kind,sig,question,neighbors,src],i)=>{
    const c=cases.find(x=>x.id===num);
    if(!c||!acceptance[i])throw Error(`Missing case investigation: ${num}`);
    return {id:`case-${num}`,kind,branch:pathToCase(num).slice(5),title:c.title,aliases:aliases(sig),
      upstream:words(src),primary:c.links.map(x=>x.url),related:words(neighbors),cases:[num],
      scope:strip(c.trigger),reproduce:strip(c.repro),checks:[{question,inspect:strip(c.clue),action:strip(c.fix),verify:acceptance[i]}]};
  });
  const pin='https://github.com/apache/spark/blob/dada2a6db5d73b152d6ba16e4fe21406f86abfe3/';
  const code={
    'kryo-limit':'core/src/main/scala/org/apache/spark/serializer/KryoSerializer.scala#L442-L466',
    'task-size':'core/src/main/scala/org/apache/spark/scheduler/cluster/CoarseGrainedSchedulerBackend.scala#L455-L479',
    'broadcast-size':'sql/core/src/main/scala/org/apache/spark/sql/execution/exchange/BroadcastExchangeExec.scala#L176-L220',
    'shuffle-registration':'core/src/main/scala/org/apache/spark/internal/config/package.scala#L1111-L1123',
    'sql-correlation':'common/utils/src/main/resources/error/error-conditions.json#L10348-L10364'
  };
  const records=[...base,...extra.map(d=>({...d,reproduce:comparisons[d.id],primary:code[d.id]?[...d.primary,pin+code[d.id]]:d.primary}))];
  const byId=new Map(records.map(d=>[d.id,d]));
  if(byId.size!==records.length)throw Error('Duplicate diagnosis ID');
  for(const d of records){
    if(!d.reproduce)throw Error(`Missing safe observation control for ${d.id}`);
    for(const id of d.related)if(!byId.has(id))throw Error(`Unknown related path ${d.id} -> ${id}`);
    for(const s of d.upstream)if(!inventory.pages.some(p=>p.section==='details'&&p.slug===s))throw Error(`Unknown upstream article ${s}`);
    if(!d.primary.every(url=>url?.startsWith('https://')))throw Error(`Missing primary reference in ${d.id}`);
  }
  const coverage=inventory.pages.map(p=>{
    if(p.section==='flowchart'){
      const nodes=p.nodes.map(n=>{
        const targets=words(graphTargets[n]??'');
        if(!targets.length||!targets.every(k=>byId.has(k)))throw Error(`Unmapped upstream branch ${p.slug}/${n}`);
        return {node:n,targets};
      });
      return {...p,nodes,targets:[...new Set(nodes.flatMap(n=>n.targets))]};
    }
    const targets=records.filter(d=>d.upstream.includes(p.slug)).map(d=>d.id);
    if(!targets.length)throw Error(`Unmapped upstream page: ${p.slug}`);
    return {...p,targets};
  });
  return {rev:inventory.rev,coverage,records};
}
