package com.cj.zhixu.controller;

import com.cj.zhixu.pojo.common.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;

@RestController
public class HealthController {
    @GetMapping("/api/health")
    public Result<HashMap> getHealth(){
        HashMap m = new HashMap<>();
        m.put("app","zhixu-api");
        m.put("time", LocalDateTime.now());
        return new Result<>(0,"success",m);
    }
}
