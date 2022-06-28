/**
 * 本模块存放各种字符串转换相关函数
 */

import { chain } from 'lodash';
import md5 from 'md5';
import moment from 'moment';
import { v4 as uuidV4 } from 'uuid';

import { anyBase } from './anyBase';

/**
 * 最保守的 URI 安全字
 * 为了防止任何可能出现的分词、分析等行为放弃了所有符号，为保证在大小写不敏感的平台上可以正常使用放弃了大写字符
 * 这样可以保证从这个模块压缩过的字符可以在最大可能性随时在任何场景下不作任何处理就可以作为 identity 使用
 */
const URISafeCharSet = '0123456789abcdefghijklmnopqrstuvwxyz';

// 16进制转 URI 安全字
const HEX2USC: (x: string) => string = anyBase('HEX', URISafeCharSet);
// 10进制转 URI 安全字
const DEC2USC: (x: string) => string = anyBase('DEC', URISafeCharSet);

export const safeShortenUUID = (): string => HEX2USC(uuidV4().replace(/-/g, ''));
export const safeShortenDate = (): string => DEC2USC(moment().format('YYYYMMDD'));

export const getObjectHash = (obj: {}) => {
  return chain(obj)
    .toPairs()
    .sortBy((pair) => pair[0])
    .thru((ele) => JSON.stringify(ele))
    .thru((ele) => md5(ele))
    .value();
};
