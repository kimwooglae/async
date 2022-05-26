/**
 * 비동기 작업을 관리하는 객체
 *
 * @author Inswave Systems
 * @namespace asyncWorker
 * @description
  asyncWorker 객체는 전역에 생성되어 동작하며 asyncWorker.create() 메소드를 이용하여 초기화된다. 
  create() 메소드는 worker에 접근할 때 사용되는 uuid를 반환한다. uuid를 이용하면 서로 다른 함수에서 worker에 접근할 수 있다. 
  모든 작업이 완료되면 destroy()를 이용하여 worker를 제거할 수 있다. 
 */
var asyncWorker = (function () {
  let asyncWorkerObj = {};
  let asyncWorkerObjId = [];
  let generateUuid = function () {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
  };

  /**
   * worker를 생성하고 worker접근에 필요한 uuid를 반환한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @return {String} uuid
   * @example
   * var workerId = asyncWorker.create();
   */
  let create = function () {
    let uuid = generateUuid();
    asyncWorkerObj[uuid] = {
      promiseUuid: [],
      promises: [],
      resolves: [],
      rejectes: [],
      promiseObj: {},
      resolveObj: {},
      rejectObj: {},
    };
    asyncWorkerObjId.push(uuid);
    return uuid;
  };

  /**
   * worker 내부에 Promise를 생성하고 가장 마지막에 생성된 Promise와 Promise chain으로 연결한다.
   * 구체적인 동작은 다음과 같다.
   *  Promise.allSettled([마지막 생성된 Promise 객체]).then(() => promise)
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String} uuid worker에 접근하기 위한 uuid
   * @param {Function} callback Promise가 resolve된 경우 then() 함수의 인자로 전달될 callback 함수
   * @return {String} promiseUuid
   * @example
   * var promiseId = asyncWorker.addSerialPromise('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   */
  let addSerialPromise = function (uuid, callback) {
    let chainUuid = asyncWorkerObj[uuid].promiseUuid[asyncWorkerObj[uuid].promiseUuid.length - 1];
    return addPromise({ uuid, chainUuid }, callback);
  };

  /**
   * worker 내부에 promise를 생성하고 promiseUuid를 반환한다.
   * 첫번째 인자가 문자열인 경우 worker에 접근하기 위한 uuid로 사용하고 다른 Promise와 Promise chain으로 연결하지 않는다.
   * 첫번째 인자가 객체인 경우 uuid 속성을 worker에 접근하기 위한 uuid로 사용하고 chainUuid 속성에 지정된 promiseUuid로 저장된 Promise들과 Promise chain으로 연결한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String|Object} uuid worker에 접근하기 위한 uuid 또는 uuid와 chainUuid를 가진 객체
   * @param {String} uuid.uuid worker에 접근하기 위한 uuid
   * @param {Array} uuid.chainUuid Promise chain에 연결할 promiseUuid 배열
   * @param {Function} callback Promise가 resolve된 경우 then() 함수의 인자로 전달될 callback 함수
   * @return {String} uuid
   * @example
   *  var workerId = asyncWorker.addPromise("49a16e73-6f72-48e2-935a-5c7129fdf8af");
   *  var workerId = asyncWorker.addPromise("49a16e73-6f72-48e2-935a-5c7129fdf8af", () => {
   *    console.log("callback");
   *  });
   *  var workerId = asyncWorker.addPromise({
   *    uuid: "49a16e73-6f72-48e2-935a-5c7129fdf8af",
   *    chainUuid: ["e77c9414-a26b-4005-ac41-ea198ecce29b", "a9a91d67-1485-4291-b7c6-72bbdc093b63"],
   *  });
   *  var workerId = asyncWorker.addPromise(
   *    {
   *      uuid: "49a16e73-6f72-48e2-935a-5c7129fdf8af",
   *      chainUuid: ["e77c9414-a26b-4005-ac41-ea198ecce29b", "a9a91d67-1485-4291-b7c6-72bbdc093b63"],
   *    },
   *    () => {
   *      console.log("callback");
   *    }
   *  );
   */
  let addPromise = function (uuid, callback) {
    let rootuuid, chainUuid;
    let chainPromise = [];
    if (typeof uuid === "object") {
      rootuuid = uuid.uuid;
      chainUuid = uuid.chainUuid;
      if (Object.prototype.toString.call(chainUuid) === "[object Array]") {
        for (let i = 0; i < chainUuid.length; i++) {
          chainPromise.push(asyncWorkerObj[rootuuid].promiseObj[chainUuid[i]]);
        }
      } else {
        chainPromise.push(asyncWorkerObj[rootuuid].promiseObj[chainUuid]);
      }
    } else {
      rootuuid = uuid;
    }
    let resolver, rejector;
    let promise = new Promise(function (resolve, reject) {
      resolver = resolve;
      rejector = reject;
    });

    if (chainPromise.length > 0) {
      promise = Promise.allSettled(chainPromise).then((values) => {
        return promise;
      });
    }
    if (callback) {
      promise = promise.then(callback);
    }
    let promiseUuid = generateUuid();
    asyncWorkerObj[rootuuid].promiseUuid.push(promiseUuid);
    asyncWorkerObj[rootuuid].promises.push(promise);
    asyncWorkerObj[rootuuid].resolves.push(resolver);
    asyncWorkerObj[rootuuid].rejectes.push(rejector);
    asyncWorkerObj[rootuuid].promiseObj[promiseUuid] = promise;
    asyncWorkerObj[rootuuid].resolveObj[promiseUuid] = resolver;
    asyncWorkerObj[rootuuid].rejectObj[promiseUuid] = rejector;
    return promiseUuid;
  };

  /**
   * worker 내부에 Promise를 반환한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String} uuid worker에 접근하기 위한 uuid
   * @param {String} promiseUuid Promise를 반환할 promiseUuid
   * @return {Object} Promise 객체
   * @example
   * var workerId = asyncWorker.getPromise('49a16e73-6f72-48e2-935a-5c7129fdf8af', 'e77c9414-a26b-4005-ac41-ea198ecce29b');
   */
  let getPromise = function (uuid, promiseUuid) {
    if (asyncWorkerObj[uuid] && typeof promiseUuid !== "undefined") {
      return asyncWorkerObj[uuid].promiseObj[promiseUuid];
    }
  };

  /**
   * worker 내부의 Promise를 resolve한다.
   * 첫번째 인자가 문자열인 경우 worker에 접근하기 위한 uuid로 사용하고 해당 worker의 마지막 생성된 Promise를 resolve한다.
   * 첫번째 인자가 객체인 경우 uuid 속성을 worker에 접근하기 위한 uuid로 사용하고 promiseUuid 속성에 지정된 promiseUuid로 저장된 Promise를 resolve한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String|Object} uuid worker에 접근하기 위한 uuid 또는 uuid와 promiseUuid 객체
   * @param {String} uuid.uuid worker에 접근하기 위한 uuid
   * @param {Array} uuid.promiseUuid Promise를 반환할 promiseUuid
   * @param {Object} data Promise를 resolve할 때 전달할 데이터
   * @return {String} resolve된 Promise udid
   * @example
   * var workerId = asyncWorker.resolve('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   * var workerId = asyncWorker.resolve('49a16e73-6f72-48e2-935a-5c7129fdf8af', 'resolveData');
   * var workerId = asyncWorker.resolve({
   *   uuid: "49a16e73-6f72-48e2-935a-5c7129fdf8af",
   *   promiseUuid: "e77c9414-a26b-4005-ac41-ea198ecce29b",
   * });
   * var workerId = asyncWorker.resolve(
   *   {
   *     uuid: "49a16e73-6f72-48e2-935a-5c7129fdf8af",
   *     promiseUuid: "e77c9414-a26b-4005-ac41-ea198ecce29b",
   *   },
   *   "resolveData"
   * );
   */
  let resolve = function (uuid, data) {
    let uuid1, promiseUuid;
    if (typeof uuid === "object") {
      uuid1 = uuid.uuid;
      promiseUuid = uuid.promiseUuid;
    } else {
      uuid1 = uuid;
      promiseUuid = undefined;
    }
    if (asyncWorkerObj[uuid1]) {
      let resolve, reject;
      if (typeof promiseUuid === "undefined") {
        for (let i = 0; i < asyncWorkerObj[uuid1].resolves.length; i++) {
          if (asyncWorkerObj[uuid1].resolves[i] != null) {
            resolve = asyncWorkerObj[uuid1].resolves[i];
            reject = asyncWorkerObj[uuid1].rejectes[i];
            asyncWorkerObj[uuid1].resolves[i] = null;
            asyncWorkerObj[uuid1].rejectes[i] = null;
            promiseUuid = asyncWorkerObj[uuid1].promiseUuid[i];
            break;
          }
        }
      } else {
        resolve = asyncWorkerObj[uuid1].resolveObj[promiseUuid];
        reject = asyncWorkerObj[uuid1].rejectObj[promiseUuid];
        let index = asyncWorkerObj[uuid1].resolves.indexOf(resolve);
        asyncWorkerObj[uuid1].resolves[index] = null;
        index = asyncWorkerObj[uuid1].rejectes.indexOf(reject);
        asyncWorkerObj[uuid1].rejectes[index] = null;
      }
      if (resolve) {
        resolve(data);
      }
    }
    return promiseUuid;
  };

  /**
   * worker 내부의 Promise를 reject한다.
   * 첫번째 인자가 문자열인 경우 worker에 접근하기 위한 uuid로 사용하고 해당 worker의 마지막 생성된 Promise를 reject한다.
   * 첫번째 인자가 객체인 경우 uuid 속성을 worker에 접근하기 위한 uuid로 사용하고 promiseUuid 속성에 지정된 promiseUuid로 저장된 Promise를 reject한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String|Object} uuid worker에 접근하기 위한 uuid 또는 uuid와 promiseUuid 객체
   * @param {String} uuid.uuid worker에 접근하기 위한 uuid
   * @param {Array} uuid.promiseUuid Promise를 반환할 promiseUuid
   * @param {Object} data Promise를 reject할 때 전달할 데이터
   * @return {String} resolve된 Promise udid
   * @example
   * var workerId = asyncWorker.reject('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   * var workerId = asyncWorker.reject('49a16e73-6f72-48e2-935a-5c7129fdf8af', 'resolveData');
   * var workerId = asyncWorker.reject({
   *   uuid: "49a16e73-6f72-48e2-935a-5c7129fdf8af",
   *   promiseUuid: "e77c9414-a26b-4005-ac41-ea198ecce29b",
   * });
   * var workerId = asyncWorker.reject(
   *   {
   *     uuid: "49a16e73-6f72-48e2-935a-5c7129fdf8af",
   *     promiseUuid: "e77c9414-a26b-4005-ac41-ea198ecce29b",
   *   },
   *   "rejectData"
   * );
   */
  let reject = function (uuid, data) {
    let uuid1, promiseUuid;
    if (typeof uuid === "object") {
      uuid1 = uuid.uuid;
      promiseUuid = uuid.promiseUuid;
    } else {
      uuid1 = uuid;
      promiseUuid = undefined;
    }
    if (asyncWorkerObj[uuid1]) {
      let resolve, reject;
      if (typeof promiseUuid === "undefined") {
        for (let i = 0; i < asyncWorkerObj[uuid1].resolves.length; i++) {
          if (asyncWorkerObj[uuid1].resolves[i] != null) {
            resolve = asyncWorkerObj[uuid1].resolves[i];
            reject = asyncWorkerObj[uuid1].rejectes[i];
            asyncWorkerObj[uuid1].resolves[i] = null;
            asyncWorkerObj[uuid1].rejectes[i] = null;
            promiseUuid = asyncWorkerObj[uuid1].promiseUuid[i];
            break;
          }
        }
      } else {
        resolve = asyncWorkerObj[uuid1].resolveObj[promiseUuid];
        reject = asyncWorkerObj[uuid1].rejectObj[promiseUuid];
        let index = asyncWorkerObj[uuid1].resolves.indexOf(resolve);
        asyncWorkerObj[uuid1].resolves[index] = null;
        index = asyncWorkerObj[uuid1].rejectes.indexOf(reject);
        asyncWorkerObj[uuid1].rejectes[index] = null;
      }
      if (reject) {
        reject(data);
      }
    }
    return promiseUuid;
  };

  /**
   * worker 내부의 모든 Promise를 resolve한다.
   * 이미 resolve, reject된 Promise는 무시한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String} uuid worker에 접근하기 위한 uuid
   * @param {Object} data Promise를 resolve할 때 전달할 데이터
   * @example
   * var workerId = asyncWorker.resolveAll('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   * var workerId = asyncWorker.resolveAll('49a16e73-6f72-48e2-935a-5c7129fdf8af', 'resolveData');
   */
  let resolveAll = function (uuid, data) {
    if (asyncWorkerObj[uuid]) {
      for (let i = 0; i < asyncWorkerObj[uuid1].resolves.length; i++) {
        if (asyncWorkerObj[uuid1].resolves[i] != null) {
          let resolve = asyncWorkerObj[uuid1].resolves[i];
          let reject = asyncWorkerObj[uuid1].rejectes[i];
          asyncWorkerObj[uuid1].resolves[i] = null;
          asyncWorkerObj[uuid1].rejectes[i] = null;
          resolve(data);
        }
      }
    }
  };

  /**
   * worker 내부의 모든 Promise를 reject한다.
   * 이미 resolve, reject된 Promise는 무시한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String} uuid worker에 접근하기 위한 uuid
   * @param {Object} data Promise를 reject할 때 전달할 데이터
   * @example
   * var workerId = asyncWorker.rejectAll('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   * var workerId = asyncWorker.rejectAll('49a16e73-6f72-48e2-935a-5c7129fdf8af', 'resolveData');
   */
  let rejectAll = function (uuid, data) {
    if (asyncWorkerObj[uuid]) {
      for (let i = 0; i < asyncWorkerObj[uuid1].resolves.length; i++) {
        if (asyncWorkerObj[uuid1].resolves[i] != null) {
          let resolve = asyncWorkerObj[uuid1].resolves[i];
          let reject = asyncWorkerObj[uuid1].rejectes[i];
          asyncWorkerObj[uuid1].resolves[i] = null;
          asyncWorkerObj[uuid1].rejectes[i] = null;
          reject(data);
        }
      }
    }
  };
  var promose = asyncWorker.join("49a16e73-6f72-48e2-935a-5c7129fdf8af").then((data) => {
    data.forEach((item) => {
      console.log(item);
    });
  });
  /**
   * worker 내부의 모든 Promise가 settle(resolve 또는 reject)된 후 settle되는 promise를 반환한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String} uuid worker에 접근하기 위한 uuid
   * @return {Promise} settle되는 Promise로 worker 내부의 Promise의 resolve 값 또는 reject 사유가 포함된 배열을 반환한다.
   * @example
   * var promose = asyncWorker.join("49a16e73-6f72-48e2-935a-5c7129fdf8af").then((data) => {
   *   data.forEach((item) => {
   *     console.log(item);
   *   });
   * });
   * var data = await asyncWorker.join('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   */
  let join = function (uuid) {
    if (asyncWorkerObj[uuid]) {
      let promises = asyncWorkerObj[uuid].promises;
      return Promise.allSettled(promises).then((values) => {
        let retObj = [];
        values.forEach((value) => {
          if (value.status === "fulfilled") {
            retObj.push(value.value);
          } else {
            retObj.push(value.reason);
          }
        });
        return retObj;
      });
    } else {
      return Promise.resolve();
    }
  };

  /**
   * worker 내부의 모든 Promise를 resolve한다.
   * 내부의 모든 Promise가 settle(resolve 또는 reject)된 후 settle되는 promise를 반환한다
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String} uuid worker에 접근하기 위한 uuid
   * @return {Promise} settle되는 Promise로 worker 내부의 Promise의 resolve 값 또는 reject 사유가 포함된 배열을 반환한다.
   * @example
   * var promose = asyncWorker.stop("49a16e73-6f72-48e2-935a-5c7129fdf8af").then((data) => {
   *   data.forEach((item) => {
   *     console.log(item);
   *   });
   * });
   * var data = await asyncWorker.stop('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   */
  let stop = function (uuid) {
    resolveAll(uuid);
    return join(uuid);
  };

  /**
   * worker 내부의 모든 Promise를 resolve한 후 worker를 삭제한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String} uuid worker에 접근하기 위한 uuid
   * @example
   * asyncWorker.destroy('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   */
  let destroy = function (uuid) {
    resolveAll(uuid);
    delete asyncWorkerObj[uuid];
    let index = asyncWorkerObjId.indexOf(uuid);
    if (index !== -1) {
      asyncWorkerObjId.splice(index, 1);
    }
  };

  /**
   * worker 내부의 모든 Promise의 상태를 반환하는 Promise를 return한다. 일부 Promise가 pending이면 pending으로 반환한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String} uuid worker에 접근하기 위한 uuid
   * @return {Promise} worker의 상태를 반환하는 Promise로 pending, fulfilled, rejected 중 한가지 값을 반환한다.
   * @example
   * var promose = asyncWorker.getStatus("49a16e73-6f72-48e2-935a-5c7129fdf8af").then((data) => {
   *   console.log(data);
   * });
   * var status = await asyncWorker.getStatus('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   */
  let getStatus = function (uuid) {
    const t = {};
    if (asyncWorkerObj[uuid]) {
      let promises = Promise.allSettled(asyncWorkerObj[uuid].promises);
      return new Promise(function (resolve, reject) {
        setTimeout(() => {
          console.log("[asyncWorker.getStatus]", promises);
          Promise.race([promises, t]).then(
            (v) => {
              resolve(v === t ? "pending" : "fulfilled");
            },
            () => {
              resolve("rejected");
            }
          );
        }, 1);
      });
    } else {
      return Promise.resolve("fulfilled");
    }
  };

  /**
   * worker 내부의 모든 Promise의 상세한 상태를 반환하는 Promise를 return한다.
   * Promise는 객체를 반환하는데 status 속성은 일부 Promise가 pending이면 pending으로 설정된다.
   * detail 속성은 promiseUuid를 key로 하는 상태 정보 객체가 포함된다.
   * 예시 : { "status": "pending" , "detail": { "1cbf6ad9-fd10-4e8f-b57e-41977ed79b3d": "fulfilled", "4be4d3d4-533b-45c6-b971-72778f6422b2": "pending" }}
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String} uuid worker에 접근하기 위한 uuid
   * @return {Promise} worker의 상태를 반환하는 Promise로 status, detail 속성을 가지며 각 속성은 pending, fulfilled, rejected 중 한가지 값을 가진다.
   * @example
   * var promose = asyncWorker.getDetailedStatus("49a16e73-6f72-48e2-935a-5c7129fdf8af").then((data) => {
   *   console.log(data);
   * });
   * var status = await asyncWorker.getDetailedStatus('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   */
  let getDetailedStatus = function (uuid) {
    const t = {};
    if (asyncWorkerObj[uuid]) {
      let statusObj = { detail: {} };
      let promises = Promise.allSettled(asyncWorkerObj[uuid].promises);
      let detailePromises = [];
      for (let promiseUuid in asyncWorkerObj[uuid].promiseObj) {
        detailePromises.push(
          Promise.race([asyncWorkerObj[uuid].promiseObj[promiseUuid], t]).then(
            (v) => (statusObj.detail[promiseUuid] = v === t ? "pending" : "fulfilled"),
            () => (statusObj.detail[promiseUuid] = "rejected")
          )
        );
      }

      return new Promise(function (resolve, reject) {
        setTimeout(() => {
          console.log("[asyncWorker.getStatus]", promises);
          Promise.allSettled(detailePromises).then(() =>
            Promise.race([promises, t]).then(
              (v) => {
                statusObj.status = v === t ? "pending" : "fulfilled";
                resolve(statusObj);
              },
              () => {
                statusObj.status = "rejected";
                resolve(statusObj);
              }
            )
          );
        }, 1);
      });
    } else {
      return Promise.resolve({ status: "fulfilled", detail: {} });
    }
  };

  /**
   * worker uuid 목록이 포함된 배열을 반환한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @return {Array} 모든 worker의 uuid가 포함된 array
   * @example
   * var uuids = asyncWorker.getWorkerId();
   */
  let getWorkerId = function () {
    return asyncWorkerObjId;
  };

  /**
   * Promise uuid 목록이 포함된 배열을 반환한다.
   *
   * @memberof asyncWorker
   * @author Inswave Systems
   * @param {String} uuid worker에 접근하기 위한 uuid
   * @return {Array} 모든 Promise의 uuid가 포함된 array
   * @example
   * var uuids = asyncWorker.getPromiseId('49a16e73-6f72-48e2-935a-5c7129fdf8af');
   */
  let getPromiseId = function (uuid) {
    if (asyncWorkerObj[uuid]) {
      return asyncWorkerObj[uuid].promiseUuid;
    } else {
      return [];
    }
  };
  return {
    create: create,
    resolve: resolve,
    reject: reject,
    resolveAll: resolveAll,
    rejectAll: rejectAll,
    join: join,
    stop: stop,
    destroy: destroy,
    getPromise: getPromise,
    addPromise: addPromise,
    addSerialPromise: addSerialPromise,
    getWorkerId: getWorkerId,
    getPromiseId: getPromiseId,
    getStatus: getStatus,
    getDetailedStatus: getDetailedStatus,
  };
})();
